/* ─── Enclave OpenAI-Compatible Provider Layer ───
 * Multi-provider detection with automatic failover.
 * Scans try every configured provider in priority order until one answers:
 *   Cerebras > GitHub Models > Groq > OpenRouter > Mistral > SiliconFlow > custom
 * Per-provider cooldowns: 429/503 -> ~1 min, 401/402/403 -> 1 hour.
 * SHA-256 result cache (24h TTL) shared across providers.
 *
 * Configure via env: CEREBRAS_API_KEY | GITHUB_MODELS_TOKEN | GROQ_API_KEY |
 *   OPENROUTER_API_KEY | MISTRAL_API_KEY | SILICONFLOW_API_KEY
 * Or a fully custom endpoint: AI_BASE_URL + AI_API_KEY + AI_VISION_MODEL + AI_TEXT_MODEL
 */

const crypto = require('crypto');
const { normalizeVerdict, clampConfidence } = require('./verdict-utils');

const REQUEST_TIMEOUT = 60000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;
const RATE_LIMIT_COOLDOWN_MS = 65 * 1000;
const PROVIDER_DISABLED_COOLDOWN_MS = 60 * 60 * 1000;

const PRESETS = {
  cerebras: {
    id: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyEnv: 'CEREBRAS_API_KEY',
    visionModel: process.env.CEREBRAS_VISION_MODEL || 'llama-4-scout-17b-16e-instruct',
    textModel: process.env.CEREBRAS_TEXT_MODEL || 'llama-3.3-70b',
    extraHeaders: {},
  },
  'github-models': {
    id: 'github-models',
    baseUrl: 'https://models.github.ai/inference',
    keyEnv: 'GITHUB_MODELS_TOKEN',
    visionModel: process.env.GH_VISION_MODEL || 'openai/gpt-4o-mini',
    textModel: process.env.GH_TEXT_MODEL || 'openai/gpt-4o-mini',
    extraHeaders: {},
  },
  groq: {
    id: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    visionModel: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    textModel: process.env.GROQ_TEXT_MODEL || 'llama-3.1-8b-instant',
    extraHeaders: {},
  },
  openrouter: {
    id: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    visionModel: process.env.OPENROUTER_VISION_MODEL || 'meta-llama/llama-3.2-11b-vision-instruct:free',
    textModel: process.env.OPENROUTER_TEXT_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
    extraHeaders: { 'HTTP-Referer': 'https://enclave.app', 'X-Title': 'Enclave' },
  },
  mistral: {
    id: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keyEnv: 'MISTRAL_API_KEY',
    visionModel: process.env.MISTRAL_VISION_MODEL || 'pixtral-12b-2409',
    textModel: process.env.MISTRAL_TEXT_MODEL || 'mistral-small-latest',
    extraHeaders: {},
  },
  siliconflow: {
    id: 'siliconflow',
    baseUrl: 'https://api.siliconflow.com/v1',
    keyEnv: 'SILICONFLOW_API_KEY',
    visionModel: process.env.SILICONFLOW_VISION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct',
    textModel: process.env.SILICONFLOW_TEXT_MODEL || 'Qwen/Qwen3-8B',
    extraHeaders: {},
  },
};

/* ─── Provider resolution (all configured, priority order) ─── */
function configuredProviders() {
  const list = [];

  const customKey = process.env.AI_API_KEY;
  if (customKey && customKey.length > 10 && process.env.AI_BASE_URL) {
    list.push({
      id: (process.env.AI_PROVIDER || 'custom').toLowerCase(),
      baseUrl: process.env.AI_BASE_URL,
      apiKeyValue: customKey,
      visionModel: process.env.AI_VISION_MODEL,
      textModel: process.env.AI_TEXT_MODEL,
      extraHeaders: {},
    });
  }

  for (const preset of Object.values(PRESETS)) {
    const key = process.env[preset.keyEnv];
    if (key && key.length > 10) {
      list.push({ ...preset, apiKeyValue: key });
    }
  }
  return list;
}

function isConfigured() {
  return configuredProviders().length > 0;
}

/* ─── Per-provider cooldown state ─── */
const _pstate = {};

function _st(id) {
  if (!_pstate[id]) _pstate[id] = { visionCooldownUntil: 0, textCooldownUntil: 0 };
  return _pstate[id];
}

function _markRateLimited(id, modality) {
  _st(id)[modality + 'CooldownUntil'] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

function _markDisabled(id, modality) {
  _st(id)[modality + 'CooldownUntil'] = Date.now() + PROVIDER_DISABLED_COOLDOWN_MS;
}

/* Aggregated counters */
const _totals = { requestsToday: 0, totalRequests: 0, dayKey: null, cacheHits: 0 };

function _dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function _rollDayIfNeeded() {
  if (_totals.dayKey !== _dayKey()) {
    _totals.dayKey = _dayKey();
    _totals.requestsToday = 0;
  }
}

/* ─── Cache ─── */
const _cache = new Map();

function _cacheGet(hash) {
  const entry = _cache.get(hash);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    _cache.delete(hash);
    return null;
  }
  _cache.delete(hash);
  _cache.set(hash, entry);
  _totals.cacheHits++;
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

/* ─── Core chat request (per-provider) ─── */
async function _chat(provider, model, messages, modality) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKeyValue}`,
        ...provider.extraHeaders,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        max_tokens: 600,
        ...(provider.id === 'mistral' ? {} : { response_format: { type: 'json_object' } }),
      }),
    });
    clearTimeout(timeout);

    if (res.status === 429 || res.status === 503) {
      _markRateLimited(provider.id, modality);
      throw Object.assign(new Error(`${provider.id} rate limited (${res.status})`), { code: 'RATE_LIMITED' });
    }
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      _markDisabled(provider.id, modality);
      throw Object.assign(
        new Error(`${provider.id} unavailable (${res.status}) — balance/auth`),
        { code: 'PROVIDER_DISABLED' }
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw Object.assign(
        new Error(`${provider.id} returned ${res.status}: ${text.slice(0, 200)}`),
        { code: 'API_ERROR' }
      );
    }

    const body = await res.json();
    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) throw Object.assign(new Error(`Empty ${provider.id} response`), { code: 'EMPTY_RESPONSE' });

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json?\s*|```$/g, '').trim());
    } catch (_) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw Object.assign(new Error(`Unparseable ${provider.id} JSON`), { code: 'PARSE_ERROR' });
    }

    _rollDayIfNeeded();
    _totals.totalRequests++;
    _totals.requestsToday++;

    return parsed;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/* ═══════════════ PUBLIC API ═══════════════ */

/** Image deepfake analysis — tries each configured provider until one succeeds. */
async function detectImage(buffer, mimetype, filename) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cached = _cacheGet('img:' + hash);
  if (cached) return cached;

  for (const provider of configuredProviders()) {
    if (!provider.visionModel) continue;
    if (Date.now() < _st(provider.id).visionCooldownUntil) continue;

    try {
      const raw = await _chat(
        provider,
        provider.visionModel,
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
                  'Respond ONLY with JSON: {"synthetic_score": <0-100, 0=authentic photo, 100=certainly AI-generated>, ' +
                  '"faces_detected": <integer>, "reasoning": "<one sentence>", "artifacts": ["<anomaly>", "..."]}',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mimetype || 'image/jpeg'};base64,${buffer.toString('base64')}` },
              },
            ],
          },
        ],
        'vision'
      );

      const confidence = clampConfidence(raw.synthetic_score);
      const result = {
        confidence,
        verdict: normalizeVerdict(confidence),
        ml_avg_score: confidence / 100,
        face_count: Number.isFinite(raw.faces_detected) ? raw.faces_detected : 0,
        explanation: String(raw.reasoning || '').slice(0, 500),
        artifacts: Array.isArray(raw.artifacts) ? raw.artifacts.slice(0, 6) : [],
        provider: provider.id,
        cached: false,
      };
      _cacheSet('img:' + hash, result);
      return result;
    } catch (e) {
      if (e.code === 'RATE_LIMITED' || e.code === 'PROVIDER_DISABLED') continue; // failover
      console.warn(`[${provider.id}] image detect failed:`, e.message);
    }
  }
  return null;
}

/** AI-generated-text analysis — tries each configured provider until one succeeds. */
async function detectText(text) {
  if (!isConfigured()) return null;
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return { error: 'Text must be at least 20 characters' };
  }

  const trimmed = text.slice(0, 8000);
  const hash = crypto.createHash('sha256').update(trimmed).digest('hex');
  const cached = _cacheGet('txt:' + hash);
  if (cached) return cached;

  for (const provider of configuredProviders()) {
    if (!provider.textModel) continue;
    if (Date.now() < _st(provider.id).textCooldownUntil) continue;

    try {
      const raw = await _chat(
        provider,
        provider.textModel,
        [
          {
            role: 'user',
            content:
              'You are a forensic linguist detecting AI-generated text. Consider: perplexity patterns, formulaic structure, ' +
              'hedging phrases, uniform sentence length, list-heavy formatting, absence of personal idiosyncrasy. ' +
              'Respond ONLY with JSON: {"ai_generated_score": <0-100, 0=clearly human, 100=almost certainly AI>, ' +
              '"likely_model": "<family or unknown>", "reasoning": "<one sentence>"}\n\nTEXT:\n' + trimmed,
          },
        ],
        'text'
      );

      const confidence = clampConfidence(raw.ai_generated_score);
      const result = {
        confidence,
        verdict: normalizeVerdict(confidence),
        likely_model: String(raw.likely_model || 'unknown').slice(0, 80),
        explanation: String(raw.reasoning || '').slice(0, 500),
        provider: provider.id,
        cached: false,
      };
      _cacheSet('txt:' + hash, result);
      return result;
    } catch (e) {
      if (e.code === 'RATE_LIMITED' || e.code === 'PROVIDER_DISABLED') continue;
      console.warn(`[${provider.id}] text detect failed:`, e.message);
    }
  }
  return null;
}

/** Status for dashboards — per-provider health + aggregate stats. */
function getStatus() {
  const now = Date.now();
  const providers = configuredProviders().map((p) => {
    const st = _st(p.id);
    return {
      id: p.id,
      visionModel: p.visionModel || null,
      textModel: p.textModel || null,
      visionAvailable: now >= st.visionCooldownUntil,
      textAvailable: now >= st.textCooldownUntil,
      visionCooldownMin: Math.ceil(Math.max(0, st.visionCooldownUntil - now) / 60000),
      textCooldownMin: Math.ceil(Math.max(0, st.textCooldownUntil - now) / 60000),
    };
  });

  const usable = providers.find((p) => p.visionAvailable || p.textAvailable);
  return {
    configured: providers.length > 0,
    provider: usable ? usable.id : (providers[0] ? providers[0].id : null),
    visionAvailable: providers.some((p) => p.visionAvailable),
    textAvailable: providers.some((p) => p.textAvailable),
    providers,
    cache: {
      entries: _cache.size,
      hits: _totals.cacheHits,
      ttlHours: CACHE_TTL_MS / 3600000,
    },
    requestsToday: _totals.requestsToday,
    totalRequests: _totals.totalRequests,
  };
}

module.exports = {
  detectImage,
  detectText,
  getStatus,
  isConfigured,
};
