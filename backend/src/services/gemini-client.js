/* ─── Enclave Gemini ML Client ───
 * Primary detection engine: Gemini 2.5 Flash (multimodal) + Flash-Lite fallback.
 * - SHA-256 content cache (24h TTL) to conserve free-tier quota
 * - Rate-limit awareness (429 cooldown + daily counters)
 * - Structured JSON output for deterministic verdicts
 * Free tier: Flash ~250 RPD, Flash-Lite ~1000 RPD
 */

const crypto = require('crypto');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash';
const LITE_MODEL = process.env.GEMINI_LITE_MODEL || 'gemini-2.5-flash-lite';
const REQUEST_TIMEOUT = 45000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;
const RATE_LIMIT_COOLDOWN_MS = 65 * 1000;

/* ─── State ─── */
const _cache = new Map();
const _state = {
  flashCooldownUntil: 0,
  liteCooldownUntil: 0,
  requestsToday: { flash: 0, lite: 0 },
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
    _state.requestsToday = { flash: 0, lite: 0 };
  }
}

function isConfigured() {
  return GEMINI_API_KEY.length > 10;
}

/* ─── Cache ─── */
function _cacheGet(hash) {
  const entry = _cache.get(hash);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    _cache.delete(hash);
    return null;
  }
  // LRU refresh
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

/* ─── Core request ─── */
async function _generate(model, parts, schema) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          ...(schema ? { responseSchema: schema } : {}),
        },
      }),
    });
    clearTimeout(timeout);

    if (res.status === 429 || res.status === 503) {
      if (model === FLASH_MODEL) _state.flashCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      else _state.liteCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw Object.assign(new Error(`${model} rate limited (${res.status})`), { code: 'RATE_LIMITED' });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw Object.assign(
        new Error(`${model} returned ${res.status}: ${text.slice(0, 200)}`),
        { code: 'API_ERROR' }
      );
    }

    const body = await res.json();
    const candidate = body.candidates?.[0];
    const rawText = candidate?.content?.parts
      ?.map((p) => p.text || '')
      .join('')
      .trim();
    if (!rawText) throw Object.assign(new Error('Empty Gemini response'), { code: 'EMPTY_RESPONSE' });

    let parsed;
    try {
      parsed = JSON.parse(rawText.replace(/^```json?\s*|```$/g, '').trim());
    } catch (_) {
      throw Object.assign(new Error('Gemini returned unparseable JSON'), { code: 'PARSE_ERROR' });
    }

    _rollDayIfNeeded();
    _state.totalRequests++;
    if (model === FLASH_MODEL) _state.requestsToday.flash++;
    else _state.requestsToday.lite++;

    return parsed;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function _detectWithFallback(parts, schema, parseResult) {
  if (!isConfigured()) return null;

  const now = Date.now();
  const models = [];
  if (now >= _state.flashCooldownUntil) models.push(FLASH_MODEL);
  if (now >= _state.liteCooldownUntil) models.push(LITE_MODEL);

  for (const model of models) {
    try {
      const raw = await _generate(model, parts, schema);
      return parseResult(raw, model === FLASH_MODEL ? 'gemini-flash' : 'gemini-flash-lite');
    } catch (e) {
      if (e.code === 'RATE_LIMITED') continue; // try next model
      console.warn(`[Gemini] ${model} detect failed:`, e.message);
      return null;
    }
  }
  return null;
}

/* ─── Verdict normalization ─── */
function normalizeVerdict(score) {
  if (score >= 60) return 'LIKELY_SYNTHETIC';
  if (score >= 35) return 'SUSPICIOUS';
  return 'LIKELY_NATURAL';
}

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

/* ═══════════════ PUBLIC API ═══════════════ */

const IMAGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    synthetic_score: { type: 'NUMBER' },
    faces_detected: { type: 'INTEGER' },
    reasoning: { type: 'STRING' },
    artifacts: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['synthetic_score', 'faces_detected', 'reasoning'],
};

/**
 * Detect whether an image is a deepfake / AI-generated.
 * @returns unified result or null if Gemini unavailable (caller falls back)
 */
async function detectImage(buffer, mimetype, filename) {
  if (!isConfigured()) return null;

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cached = _cacheGet('img:' + hash);
  if (cached) return cached;

  const result = await _detectWithFallback(
    [
      {
        text:
          'You are a forensic deepfake analyst. Analyze this image for signs of AI generation or manipulation. ' +
          'Look for: GAN/diffusion artifacts, impossible physics or lighting, blending seams around face/hair edges, ' +
          'inconsistent skin texture, asymmetric pupils/teeth/jewelry, warped backgrounds, unnatural frequency-domain noise. ' +
          '"synthetic_score" is your confidence from 0 (fully authentic photograph) to 100 (certainly AI-generated/manipulated). ' +
          '"faces_detected" is the number of human faces visible. "artifacts" lists specific anomalies found.',
      },
      { inlineData: { mimeType: mimetype || 'image/jpeg', data: buffer.toString('base64') } },
    ],
    IMAGE_SCHEMA,
    (raw, provider) => ({
      confidence: clampConfidence(raw.synthetic_score),
      verdict: normalizeVerdict(clampConfidence(raw.synthetic_score)),
      ml_avg_score: clampConfidence(raw.synthetic_score) / 100,
      face_count: Number.isFinite(raw.faces_detected) ? raw.faces_detected : 0,
      explanation: String(raw.reasoning || '').slice(0, 500),
      artifacts: Array.isArray(raw.artifacts) ? raw.artifacts.slice(0, 6) : [],
      provider,
      cached: false,
    })
  );

  if (result && !result.cached) _cacheSet('img:' + hash, result);
  return result;
}

const AUDIO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    synthetic_score: { type: 'NUMBER' },
    is_cloned_voice_likely: { type: 'BOOLEAN' },
    reasoning: { type: 'STRING' },
    artifacts: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['synthetic_score', 'reasoning'],
};

/** Detect whether an audio clip is AI-generated / voice-cloned. */
async function detectAudio(buffer, mimetype, filename) {
  if (!isConfigured()) return null;

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cached = _cacheGet('aud:' + hash);
  if (cached) return cached;

  const result = await _detectWithFallback(
    [
      {
        text:
          'You are a forensic audio analyst. Determine whether this recording is AI-generated (TTS or voice cloning). ' +
          'Listen for: overly smooth prosody, missing breath sounds, uniform pacing, spectral artifacts, robotic formants, ' +
          'unnatural pauses, lack of room tone. "synthetic_score" is 0 (authentic human recording) to 100 (certainly synthetic).',
      },
      { inlineData: { mimeType: mimetype || 'audio/wav', data: buffer.toString('base64') } },
    ],
    AUDIO_SCHEMA,
    (raw, provider) => ({
      confidence: clampConfidence(raw.synthetic_score),
      verdict: normalizeVerdict(clampConfidence(raw.synthetic_score)),
      voice_clone_likely: !!raw.is_cloned_voice_likely,
      explanation: String(raw.reasoning || '').slice(0, 500),
      artifacts: Array.isArray(raw.artifacts) ? raw.artifacts.slice(0, 6) : [],
      provider,
      cached: false,
    })
  );

  if (result && !result.cached) _cacheSet('aud:' + hash, result);
  return result;
}

const TEXT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ai_generated_score: { type: 'NUMBER' },
    likely_model: { type: 'STRING' },
    reasoning: { type: 'STRING' },
  },
  required: ['ai_generated_score', 'reasoning'],
};

/** Detect whether text was written by an AI language model. */
async function detectText(text) {
  if (!isConfigured()) return null;
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return { error: 'Text must be at least 20 characters' };
  }

  const trimmed = text.slice(0, 8000);
  const hash = crypto.createHash('sha256').update(trimmed).digest('hex');
  const cached = _cacheGet('txt:' + hash);
  if (cached) return cached;

  const result = await _detectWithFallback(
    [
      {
        text:
          'You are a forensic linguist. Determine whether this text was generated by an AI language model. ' +
          'Consider: perplexity patterns, formulaic structure, hedging phrases, uniform sentence length, ' +
          'list-heavy formatting, absence of personal idiosyncrasy. ' +
          '"ai_generated_score" is 0 (clearly human-written) to 100 (almost certainly AI-generated). ' +
          '"likely_model" names the most probable generating model family or "unknown".\n\nTEXT:\n' +
          trimmed,
      },
    ],
    TEXT_SCHEMA,
    (raw, provider) => ({
      confidence: clampConfidence(raw.ai_generated_score),
      verdict: normalizeVerdict(clampConfidence(raw.ai_generated_score)),
      likely_model: String(raw.likely_model || 'unknown').slice(0, 80),
      explanation: String(raw.reasoning || '').slice(0, 500),
      provider,
      cached: false,
    })
  );

  if (result && !result.cached) _cacheSet('txt:' + hash, result);
  return result;
}

/** Provider status for dashboards. */
function getStatus() {
  const now = Date.now();
  return {
    configured: isConfigured(),
    primary: {
      model: FLASH_MODEL,
      available: isConfigured() && now >= _state.flashCooldownUntil,
      cooldownRemainingMs: Math.max(0, _state.flashCooldownUntil - now),
      requestsToday: _state.requestsToday.flash,
    },
    fallback: {
      model: LITE_MODEL,
      available: isConfigured() && now >= _state.liteCooldownUntil,
      cooldownRemainingMs: Math.max(0, _state.liteCooldownUntil - now),
      requestsToday: _state.requestsToday.lite,
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
  detectAudio,
  detectText,
  getStatus,
  isConfigured,
  normalizeVerdict,
};
