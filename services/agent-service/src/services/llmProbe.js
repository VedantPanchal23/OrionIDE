/**
 * Probe a user-supplied LLM key (BYOK) without starting a pipeline.
 * POST /agents/llm/probe  { provider, apiKey, model?, baseUrl? }
 */
const axios = require('axios');
const groqService = require('../services/groqService');
const openRouterService = require('../services/openRouterService');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

async function probeLlm({ provider, apiKey, model, baseUrl }) {
  const key = String(apiKey || '').trim();
  if (!key) {
    const err = new Error('apiKey is required');
    err.code = 'LLM_MISSING_KEY';
    err.status = 400;
    throw err;
  }

  const prov = String(provider || 'openrouter').toLowerCase();
  const messages = [{ role: 'user', content: 'Reply with the single word: ok' }];

  if (prov === 'groq') {
    const text = await groqService.chat(
      model || 'llama-3.1-8b-instant',
      messages,
      { apiKey: key, maxTokens: 8, temperature: 0 },
    );
    return { ok: true, provider: 'groq', sample: String(text || '').slice(0, 80) };
  }

  if (prov === 'openrouter' || prov === 'custom') {
    const text = await openRouterService.chat(
      model || 'openai/gpt-4o-mini',
      messages,
      {
        apiKey: key,
        baseUrl: prov === 'custom' ? (baseUrl || null) : null,
        maxTokens: 8,
        temperature: 0,
      },
    );
    return { ok: true, provider: prov, sample: String(text || '').slice(0, 80) };
  }

  // Generic OpenAI-compatible models list as fallback probe
  const root = String(baseUrl || '').replace(/\/$/, '');
  if (!root) {
    const err = new Error('Unsupported provider — use openrouter, groq, or custom with baseUrl');
    err.code = 'LLM_BAD_PROVIDER';
    err.status = 400;
    throw err;
  }
  const res = await axios.get(`${root}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    timeout: 15000,
  });
  const count = Array.isArray(res.data?.data) ? res.data.data.length : null;
  logger.info('LLM probe via /models', { provider: prov, count });
  return { ok: true, provider: prov, models: count };
}

module.exports = { probeLlm };
