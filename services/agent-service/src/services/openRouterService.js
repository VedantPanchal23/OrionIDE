/**
 * Orion IDE — OpenRouter LLM Service
 *
 * Interfaces with OpenRouter API for free-tier models.
 * Uses deepseek/deepseek-coder-v2:free.
 */

const axios = require('axios');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Send a chat completion request via OpenRouter.
 *
 * @param {string} model — e.g. 'deepseek/deepseek-coder-v2:free'
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @returns {Promise<string>}
 */
const chat = async (model, messages, options = {}) => {
  const {
    temperature = 0.3,
    maxTokens = 4096,
  } = options;

  const payload = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  try {
    const response = await Promise.race([
      axios.post(OPENROUTER_URL, payload, {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://orionide.app',
          'X-Title': 'Orion IDE',
        },
        timeout: 60000,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('OpenRouter request timeout')), 60000)),
    ]);

    const content = response.data?.choices?.[0]?.message?.content || '';
    logger.debug('OpenRouter completion received', { model, tokens: response.data?.usage?.total_tokens });
    return content;
  } catch (err) {
    const status = err.response?.status;

    if (status === 429) {
      logger.warn('OpenRouter rate limited, retrying in 2s', { model });
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const retry = await axios.post(OPENROUTER_URL, payload, {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://orionide.app',
            'X-Title': 'Orion IDE',
          },
          timeout: 60000,
        });
        return retry.data?.choices?.[0]?.message?.content || '';
      } catch (retryErr) {
        throw Object.assign(new Error('OpenRouter rate limit exceeded'), { code: 'LLM_RATE_LIMIT' });
      }
    }

    if (status === 401) {
      throw Object.assign(new Error('Invalid OpenRouter API key'), { code: 'LLM_INVALID_KEY' });
    }

    if (err.message?.includes('timeout')) {
      throw Object.assign(new Error('OpenRouter request timed out after 60s'), { code: 'LLM_TIMEOUT' });
    }

    logger.error('OpenRouter chat failed', { model, error: err.message });
    throw Object.assign(new Error(`OpenRouter error: ${err.message}`), { code: 'LLM_ERROR' });
  }
};

module.exports = { chat };
