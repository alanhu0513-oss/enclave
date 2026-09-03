/* ─── Anthropic Claude Provider ───
 * Claude has a different API format than OpenAI-compatible providers.
 * Uses anthropic-version header and separate messages API.
 * Configure via: ANTHROPIC_API_KEY
 */

const crypto = require('crypto');
const { normalizeVerdict, clampConfidence } = require('./verdict-utils');

const REQUEST_TIMEOUT = 60000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const _cache = new Map();
let _cooldownUntil = 0;

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { _cache.delete(key); return null; }
  _cache.delete(key);
  _cache.set(key, entry);
  return { ...entry.result, cached: true };
}

function _cacheSet(key, result) {
  if (_cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  _cache.set(key, { result: { ...result, cached: false }, expires: Date.now() + CACHE_TTL_MS });
}

function isConfigured() {
  const key = process.env.ANTHROPIC_API_KEY;
  return key && key.length > 10;
}

async function _chat(messages, maxTokens = 600) {
  if (!isConfigured()) throw new Error('Anthropic API key not configured');
  if (Date.now() < _cooldownUntil) throw new Error('Anthropic rate limited');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages,
      }),
    });
    clearTimeout(timeout);

    if (res.status === 429 || res.status === 503) {
      _cooldownUntil = Date.now() + 65000;
      throw new Error(`Anthropic rate limited (${res.status})`);
    }
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      _cooldownUntil = Date.now() + 3600000;
      throw new Error(`Anthropic unavailable (${res.status})`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
    }

    const body = await res.json();
    const raw = body.content?.[0]?.text?.trim();
    if (!raw) throw new Error('Empty Anthropic response');

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json?\s*|```$/g, '').trim());
    } catch (_) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Unparseable Anthropic JSON');
    }

    return parsed;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function detectImage(buffer, mimetype) {
  if (!isConfigured()) return null;

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cached = _cacheGet('img:' + hash);
  if (cached) return cached;

  try {
    const raw = await _chat([
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimetype || 'image/jpeg',
              data: buffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text:
              'You are a forensic deepfake analyst. Analyze this image for signs of AI generation or manipulation. ' +
              'Look for: GAN/diffusion artifacts, impossible physics or lighting, blending seams, ' +
              'inconsistent skin texture, asymmetric features, warped backgrounds, unnatural noise patterns. ' +
              'Respond ONLY with JSON: {"synthetic_score": <0-100>, "faces_detected": <int>, ' +
              '"reasoning": "<one sentence>", "artifacts": ["<anomaly>"]}',
          },
        ],
      },
    ]);

    const confidence = clampConfidence(raw.synthetic_score);
    const result = {
      confidence,
      verdict: normalizeVerdict(confidence),
      ml_avg_score: confidence / 100,
      face_count: Number.isFinite(raw.faces_detected) ? raw.faces_detected : 0,
      explanation: String(raw.reasoning || '').slice(0, 500),
      artifacts: Array.isArray(raw.artifacts) ? raw.artifacts.slice(0, 6) : [],
      provider: 'anthropic',
      cached: false,
    };
    _cacheSet('img:' + hash, result);
    return result;
  } catch (e) {
    console.warn('[Anthropic] image detect failed:', e.message);
    return null;
  }
}

async function detectText(text) {
  if (!isConfigured()) return null;
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return { error: 'Text must be at least 20 characters' };
  }

  const trimmed = text.slice(0, 8000);
  const hash = crypto.createHash('sha256').update(trimmed).digest('hex');
  const cached = _cacheGet('txt:' + hash);
  if (cached) return cached;

  try {
    const raw = await _chat([
      {
        role: 'user',
        content:
          'You are a forensic linguist detecting AI-generated text. Consider: perplexity patterns, formulaic structure, ' +
          'hedging phrases, uniform sentence length, list-heavy formatting, absence of personal idiosyncrasy. ' +
          'Respond ONLY with JSON: {"ai_generated_score": <0-100>, "likely_model": "<family or unknown>", ' +
          '"reasoning": "<one sentence>"}\n\nTEXT:\n' + trimmed,
      },
    ]);

    const confidence = clampConfidence(raw.ai_generated_score);
    const result = {
      confidence,
      verdict: normalizeVerdict(confidence),
      likely_model: String(raw.likely_model || 'unknown').slice(0, 80),
      explanation: String(raw.reasoning || '').slice(0, 500),
      provider: 'anthropic',
      cached: false,
    };
    _cacheSet('txt:' + hash, result);
    return result;
  } catch (e) {
    console.warn('[Anthropic] text detect failed:', e.message);
    return null;
  }
}

function getStatus() {
  return {
    configured: isConfigured(),
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    available: Date.now() >= _cooldownUntil,
    cooldownMin: Math.ceil(Math.max(0, _cooldownUntil - Date.now()) / 60000),
    cache: { entries: _cache.size },
  };
}

module.exports = { detectImage, detectText, getStatus, isConfigured };
