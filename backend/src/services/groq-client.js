/* ─── Enclave Groq Client ───
 * Primary free-tier detection engine via Groq (OpenAI-compatible API).
 * - Image: meta-llama/llama-4-scout-17b-16e-instruct (vision, ~1,000 RPD)
 * - Text:  llama-3.1-8b-instant (~14,400 RPD)
 * - SHA-256 cache + 429 cooldown, quotas reset midnight UTC
 * Get a key: https://console.groq.com (no credit card required)
 */

const crypto = require('crypto');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const API_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'llama-3.1-8b-instant';
const REQUEST_TIMEOUT = 45000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;
const RATE_LIMIT_COOLDOWN_MS = 65 * 1000;

const { normalizeVerdict, clampConfidence } = require('./verdict-utils');

/* ─── State ─── */
const _cache = new Map();
const _state = {
  visionCooldownUntil: 0,
  textCooldownUntil: 0,
  requestsToday: { vision: 0, text: 0 },
  dayKey: _dayKey(),
  totalRequests: 0,
  cacheHits: 0,
};

function _dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function _rollDayIfNeeded() {
  const key = _dayKey();
  if (_state.dayKey !== key) {
    _state.dayKey = key;
    _state.requestsToday = { vision: 0, text: 0 };
  }
}

function isConfigured() {
  return GROQ_API_KEY.length > 10;
}

/* ─── Cache (shared semantics with gemini-client) ─── */
function _cacheGet(hash) {
  const entry = _cache.get(hash);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    _cache.delete(hash);
    return null;
  }
  _cache.delete(hash);
  _cache.set(hash, entry);
  _state.cacheHits++;
  return { ...entry.result, cached: true };
}

function _cacheSet(hash, result) {
  if (_cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  _cache.set(hash, {
    result: { ...result, cached: false },
    expires: Date.now() + CACHE_TTL_MS,
  });
}

/* ─── Core request (OpenAI-compatible) ─── */
async function _chat(model, messages, cooldownKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    });
    clearTimeout(timeout);

    if (res.status === 429 || res.status === 503) {
      _state[cooldownKey] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw Object.assign(new Error(`Groq ${model} rate limited (${res.status})`), { code: 'RATE_LIMITED' });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw Object.assign(
        new Error(`Groq ${model} returned ${res.status}: ${text.slice(0, 200)}`),
        { code: 'API_ERROR' }
      );
    }

    const body = await res.json();
    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) throw Object.assign(new Error('Empty Groq response'), { code: 'EMPTY_RESPONSE' });

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json?\s*|```$/g, '').trim());
    } catch (_) {
      throw Object.assign(new Error('Groq returned unparseable JSON'), { code: 'PARSE_ERROR' });
    }

    _rollDayIfNeeded();
    _state.totalRequests++;
    _state.requestsToday[cooldownKey.replace('CooldownUntil', '')] =
      (_state.requestsToday[cooldownKey.replace('CooldownUntil', '')] || 0) + 1;

    return parsed;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

function _available(cooldownUntil) {
  return isConfigured() && Date.now() >= cooldownUntil;
}

/* ═══════════════ PUBLIC API ═══════════════ */

/**
 * Detect whether an image is a deepfake / AI-generated via Llama 4 Scout vision.
 * @returns unified result or null if Groq unavailable (caller falls back)
 */
async function detectImage(buffer, mimetype, filename) {
  if (!_available(_state.visionCooldownUntil)) return null;

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cached = _cacheGet('img:' + hash);
  if (cached) return { ...cached, provider: cached.provider || 'groq-scout' };

  try {
    const raw = await _chat(
      VISION_MODEL,
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'You are a forensic deepfake analyst. Analyze this image for signs of AI generation or manipulation. ' +
                'Look for: GAN/diffusion artifacts, impossible physics or lighting, blending seams around face/hair edges, ' +
                'inconsistent skin texture, asymmetric pupils/teeth/jewelry, warped backgrounds, unnatural noise patterns. ' +
                'Respond ONLY with JSON: {"synthetic_score": <0-100 number, 0=authentic photo, 100=certainly AI-generated>, ' +
                '"faces_detected": <integer count of human faces>, "reasoning": "<one sentence>", ' +
                '"artifacts": ["<anomaly 1>", "<anomaly 2>"]}',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimetype || 'image/jpeg'};base64,${buffer.toString('base64')}` },
            },
          ],
        },
      ],
      'visionCooldownUntil'
    );

    const confidence = clampConfidence(raw.synthetic_score);
    const result = {
      confidence,
      verdict: normalizeVerdict(confidence),
      ml_avg_score: confidence / 100,
      face_count: Number.isFinite(raw.faces_detected) ? raw.faces_detected : 0,
      explanation: String(raw.reasoning || '').slice(0, 500),
      artifacts: Array.isArray(raw.artifacts) ? raw.artifacts.slice(0, 6) : [],
      provider: 'groq-scout',
      cached: false,
    };
    _cacheSet('img:' + hash, result);
    return result;
  } catch (e) {
    console.warn('[Groq] image detect failed:', e.message);
    return null;
  }
}

/**
 * Detect whether text was written by an AI language model via Llama 3.1 8B instant.
 * High daily quota (14,400 RPD) makes this the workhorse endpoint.
 */
async function detectText(text) {
  if (!isConfigured()) return null;
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return { error: 'Text must be at least 20 characters' };
  }

  const trimmed = text.slice(0, 8000);
  const hash = crypto.createHash('sha256').update(trimmed).digest('hex');
  const cached = _cacheGet('txt:' + hash);
  if (cached) return { ...cached, provider: cached.provider || 'groq-llama' };

  if (!_available(_state.textCooldownUntil)) return null;

  try {
    const raw = await _chat(
      TEXT_MODEL,
      [
        {
          role: 'user',
          content:
            'You are a forensic linguist detecting AI-generated text. Consider: perplexity patterns, formulaic structure, ' +
            'hedging phrases, uniform sentence length, list-heavy formatting, absence of personal idiosyncrasy. ' +
            'Respond ONLY with JSON: {"ai_generated_score": <0-100 number, 0=clearly human, 100=almost certainly AI-generated>, ' +
            '"likely_model": "<model family or unknown>", "reasoning": "<one sentence>"}\n\nTEXT:\n' +
            trimmed,
        },
      ],
      'textCooldownUntil'
    );

    const confidence = clampConfidence(raw.ai_generated_score);
    const result = {
      confidence,
      verdict: normalizeVerdict(confidence),
      likely_model: String(raw.likely_model || 'unknown').slice(0, 80),
      explanation: String(raw.reasoning || '').slice(0, 500),
      provider: 'groq-llama',
      cached: false,
    };
    _cacheSet('txt:' + hash, result);
    return result;
  } catch (e) {
    console.warn('[Groq] text detect failed:', e.message);
    return null;
  }
}

/** Provider status for dashboards. */
function getStatus() {
  const now = Date.now();
  return {
    configured: isConfigured(),
    vision: {
      model: VISION_MODEL,
      available: _available(_state.visionCooldownUntil),
      cooldownRemainingMs: Math.max(0, _state.visionCooldownUntil - now),
      requestsToday: _state.requestsToday.vision,
      dailyQuota: 1000,
    },
    text: {
      model: TEXT_MODEL,
      available: _available(_state.textCooldownUntil),
      cooldownRemainingMs: Math.max(0, _state.textCooldownUntil - now),
      requestsToday: _state.requestsToday.text,
      dailyQuota: 14400,
    },
    cache: {
      entries: _cache.size,
      hits: _state.cacheHits,
      ttlHours: CACHE_TTL_MS / 3600000,
    },
    totalRequests: _state.totalRequests,
  };
}

module.exports = {
  detectImage,
  detectText,
  getStatus,
  isConfigured,
};
