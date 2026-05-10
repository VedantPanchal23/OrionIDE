/**
 * Orion IDE — Groq LLM Service
 *
 * Interfaces with the Groq API for fast LLM inference.
 * Uses llama-3.3-70b-versatile and llama3-8b-8192 models.
 */

const Groq = require('groq-sdk');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

let groqClient = null;

const createClient = () => {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
};

/**
 * Send a chat completion request to Groq.
 *
 * @param {string} model — 'llama-3.3-70b-versatile' or 'llama3-8b-8192'
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options] — { temperature, maxTokens, jsonMode }
 * @returns {Promise<string>} — completion text
 */
const chat = async (model, messages, options = {}) => {
  const client = createClient();
  const {
    temperature = 0.3,
    maxTokens = 4096,
    jsonMode = false,
  } = options;

  const requestOptions = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };

  if (jsonMode) {
    requestOptions.response_format = { type: 'json_object' };
  }

  try {
    const completion = await Promise.race([
      client.chat.completions.create(requestOptions),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Groq request timeout')), 60000)),
    ]);

    const content = completion.choices?.[0]?.message?.content || '';
    logger.debug('Groq completion received', { model, tokens: completion.usage?.total_tokens });
    return content;
  } catch (err) {
    // Rate limit — retry once after 2s
    if (err.status === 429 || err.message?.includes('rate_limit')) {
      logger.warn('Groq rate limited, retrying in 2s', { model });
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const retry = await client.chat.completions.create(requestOptions);
        return retry.choices?.[0]?.message?.content || '';
      } catch (retryErr) {
        throw Object.assign(new Error(`Groq rate limit exceeded: ${retryErr.message}`), { code: 'LLM_RATE_LIMIT' });
      }
    }

    if (err.status === 401) {
      throw Object.assign(new Error('Invalid Groq API key'), { code: 'LLM_INVALID_KEY' });
    }

    if (err.message?.includes('context_length') || err.status === 413) {
      throw Object.assign(new Error('Input too long for model context window'), { code: 'LLM_CONTEXT_TOO_LONG' });
    }

    if (err.message?.includes('timeout')) {
      throw Object.assign(new Error('Groq request timed out after 60s'), { code: 'LLM_TIMEOUT' });
    }

    logger.error('Groq chat failed', { model, error: err.message });
    throw Object.assign(new Error(`Groq error: ${err.message}`), { code: 'LLM_ERROR' });
  }
};

module.exports = { createClient, chat };
