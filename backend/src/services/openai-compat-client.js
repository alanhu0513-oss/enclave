/* ─── Enclave OpenAI-Compatible Provider Layer ───
 * Generic detection client for any OpenAI-compatible free-tier provider.
 * Auto-selects the first provider whose API key env var is set:
 *   GROQ_API_KEY | CEREBRAS_API_KEY | OPENROUTER_API_KEY |
 *   MISTRAL_API_KEY | SILICONFLOW_API_KEY | GITHUB_MODELS_TOKEN
 * Or fully custom via AI_BASE_URL + AI_API_KEY + AI_VISION_MODEL + AI_TEXT_MODEL.
 *
 * Features: SHA-256 cache (24h TTL), 429 cooldown, JSON-mode outputs,
 * unified result shape identical to gemini-client.
 */

const crypto = require('crypto');
const { normalizeVerdict, clampConfidence } = require('./verdict-utils');

const REQUEST_TIMEOUT = 60000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;
const RATE_LIMIT_COOLDOWN_MS = 65 * 1000;

/* Provider presets — baseUrl + default models (OpenAI-compatible). */
const PRESETS = {
  groq: {
    label: 'groq',
    baseUrlEnv: null,
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    visionModel: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    textModel: process.env.GROQ_TEXT_MODEL || 'llama-3.1-8b-instant',
    extraHeaders: {},
  },
  cerebras: {
    label: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyEnv: 'CEREBRAS_API_KEY',
    visionModel: 'llama-4-scout-17b-16e-instruct',
    textModel: 'llama-3.3-70b',
    extraHeaders: {},
  },
  openrouter: {
    label: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    visionModel: process.env.OPENROUTER_VISION_MODEL || 'meta-llama/llama-3.2-11b-vision-instruct:free',
    textModel: process.env.OPENROUTER_TEXT_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
    extraHeaders: { 'HTTP-Referer': 'https://enclave.app', 'X-Title': 'Enclave' },
  },
  mistral: {
    label: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    keyEnv: 'MISTRAL_API_KEY',
    visionModel: 'pixtral-12b-2409',
    textModel: 'mistral-small-latest',
    extraHeaders: {},
  },
  siliconflow: {
    label: 'siliconflow',
    baseUrl: 'https://api.siliconflow.com/v1',
    keyEnv: 'SILICONFLOW_API_KEY',
    visionModel: process.env.SILICONFLOW_VISION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct',
    textModel: process.env.SILICONFLOW_TEXT_MODEL || 'Qwen/Qwen3-8B',
    extraHeaders: {},
  },
  'github-models': {
    label: 'github',
    baseUrl: 'https://models.github.ai/inference',
    keyEnv: 'GITHUB_MODELS_TOKEN',
    visionModel: 'openai/gpt-4o-mini',
    textModel: 'openai/gpt-4o-mini',
    extraHeaders: {},
  },
};

/* Custom single-provider override */
function _customPreset() {
  return {
    label: (process.env.AI_PROVIDER || 'custom').toLowerCase(),
    baseUrl: process.env.AI_BASE_URL,
    keyEnv: null,
    apiKey: process.env.AI_API_KEY,
    visionModel: process.env.AI_VISION_MODEL,
    textModel: process.env.AI_TEXT_MODEL,
    extraHeaders: {},
  };
}

/* ─── Active provider resolution ─── */
let _active = null;

function resolveProvider() {
  if (_active) return _active;

  const customKey = process.env.AI_API_KEY;
  if (customKey && customKey.length > 10 && process.env.AI_BASE_URL) {
    _active = _customPreset();
    _active.apiKeyValue = customKey;
    return _active;
  }

  for (const preset of Object.values(PRESETS)) {
    const key = process.env[preset.keyEnv];
    if (key && key.length > 10) {
      _active = { ...preset, apiKeyValue: key };
      return _active;
    }
  }
  return null;
}

/* Force re-resolution on next call (used after env reload in tests). */
function resetProvider() {
  _active = null;
}

/* ─── State per modality ─── */
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
  return !!resolveProvider();
}

/* ─── Cache ─── */
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

/* ─── Core chat request ─── */
async function _chat(model, messages, cooldownKey) {
  const provider = resolveProvider();
  if (!provider) throw Object.assign(new Error('No AI provider configured'), { code: 'NOT_CONFIGURED' });

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
        ...(provider.label === 'mistral' ? {} : { response_format: { type: 'json_object' } }),
      }),
    });
    clearTimeout(timeout);

    if (res.status === 429 || res.status === 503) {
      _state[cooldownKey] = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw Object.assign(new Error(`Provider rate limited (${res.status})`), { code: 'RATE_LIMITED' });
    }
    if (res.status === 402 || res.status === 401 || res.status === 403) {
      // Insufficient balance / auth problem — stop hitting this provider for an hour
      _state[cooldownKey] = Date.now() + 60 * 60 * 1000;
      throw Object.assign(
        new Error(`Provider unavailable (${res.status}): ${JSON.parse(await res.text().catch(() => '{}')).message || 'balance/auth'}`),
        { code: 'PROVIDER_DISABLED' }
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw Object.assign(
        new Error(`Provider returned ${res.status}: ${text.slice(0, 200)}`),
        { code: 'API_ERROR' }
      );
    }

    const body = await res.json();
    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) throw Object.assign(new Error('Empty provider response'), { code: 'EMPTY_RESPONSE' });

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json?\s*|```$/g, '').trim());
    } catch (_) {
      // Some providers wrap JSON in prose — attempt extraction
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw Object.assign(new Error('Unparseable provider JSON'), { code: 'PARSE_ERROR' });
    }

    _rollDayIfNeeded();
    _state.totalRequests++;
    const bucket = cooldownKey === 'visionCooldownUntil' ? 'vision' : 'text';
    _state.requestsToday[bucket]++;

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

/** Image deepfake analysis via the active provider's vision model. */
async function detectImage(buffer, mimetype, filename) {
  const provider = resolveProvider();
  if (!provider || !provider.visionModel || !_available(_state.visionCooldownUntil)) return null;

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cached = _cacheGet('img:' + hash);
  if (cached) return { ...cached, provider: cached.provider || provider.label };

  try {
    const raw = await _chat(
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
      provider: provider.label,
      cached: false,
    };
    _cacheSet('img:' + hash, result);
    return result;
  } catch (e) {
    if (e.code !== 'RATE_LIMITED') console.warn(`[${provider.label}] image detect failed:`, e.message);
    return null;
  }
}

/** AI-generated-text analysis via the active provider's text model. */
async function detectText(text) {
  if (!isConfigured()) return null;
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return { error: 'Text must be at least 20 characters' };
  }

  const provider = resolveProvider();
  if (!provider.textModel || !_available(_state.textCooldownUntil)) return null;

  const trimmed = text.slice(0, 8000);
  const hash = crypto.createHash('sha256').update(trimmed).digest('hex');
  const cached = _cacheGet('txt:' + hash);
  if (cached) return { ...cached, provider: cached.provider || provider.label };

  try {
    const raw = await _chat(
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
      'textCooldownUntil'
    );

    const confidence = clampConfidence(raw.ai_generated_score);
    const result = {
      confidence,
      verdict: normalizeVerdict(confidence),
      likely_model: String(raw.likely_model || 'unknown').slice(0, 80),
      explanation: String(raw.reasoning || '').slice(0, 500),
      provider: provider.label,
      cached: false,
    };
    _cacheSet('txt:' + hash, result);
    return result;
  } catch (e) {
    if (e.code !== 'RATE_LIMITED') console.warn(`[${provider.label}] text detect failed:`, e.message);
    return null;
  }
}

/** Status for dashboards: active provider + which env keys are present. */
function getStatus() {
  const provider = resolveProvider();
  const now = Date.now();
  return {
    provider: provider ? provider.label : null,
    configured: !!provider,
    visionModel: provider?.visionModel || null,
    textModel: provider?.textModel || null,
    vision: {
      available: _available(_state.visionCooldownUntil),
      cooldownRemainingMs: Math.max(0, _state.visionCooldownUntil - now),
      requestsToday: _state.requestsToday.vision,
    },
    text: {
      available: _available(_state.textCooldownUntil),
      cooldownRemainingMs: Math.max(0, _state.textCooldownUntil - now),
      requestsToday: _state.requestsToday.text,
    },
    cache: {
      entries: _cache.size,
      hits: _state.cacheHits,
      ttlHours: CACHE_TTL_MS / 3600000,
    },
    totalRequests: _state.totalRequests,
    availableProviders: Object.values(PRESETS)
      .map((p) => ({ id: p.label, keySet: !!(p.keyEnv && process.env[p.keyEnv]) })),
  };
}

module.exports = {
  detectImage,
  detectText,
  getStatus,
  isConfigured,
  resetProvider,
};
