/**
 * Orion IDE — Base Agent
 *
 * Abstract base class for all pipeline agents.
 * LLM credentials: session.llm (BYOK) via AsyncLocalStorage, else server env keys.
 */

const { AsyncLocalStorage } = require('async_hooks');
const groqService = require('../services/groqService');
const openRouterService = require('../services/openRouterService');
const axios = require('axios');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');
const llmContext = new AsyncLocalStorage();

const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;
if (!INTERNAL_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('INTERNAL_SECRET is required in production');
}
const RESOLVED_INTERNAL_SECRET = INTERNAL_SECRET || 'orion-internal-secret-dev';

class BaseAgent {
  constructor(agentName, model, provider = 'groq') {
    if (new.target === BaseAgent) throw new Error('BaseAgent is abstract');
    this.agentName = agentName;
    this.model = model;
    this.provider = provider;
  }

  /** Run work with BYOK / session LLM config bound for callLLM */
  static withLlm(llm, fn) {
    return llmContext.run(llm && typeof llm === 'object' ? llm : {}, fn);
  }

  async run() {
    throw new Error(`${this.agentName}.run() not implemented`);
  }

  getSystemPrompt() {
    throw new Error(`${this.agentName}.getSystemPrompt() not implemented`);
  }

  async callLLM(messages, options = {}) {
    const ctx = llmContext.getStore() || {};
    const provider = options.provider || ctx.provider || this.provider;
    const model = options.model || ctx.model || this.model;
    const apiKey = options.apiKey || ctx.apiKey || null;
    const baseUrl = options.baseUrl || ctx.baseUrl || null;
    const pass = { ...options, apiKey, baseUrl };
    delete pass.provider;
    delete pass.model;

    if (provider === 'openrouter' || provider === 'custom') {
      return openRouterService.chat(model, messages, pass);
    }
    return groqService.chat(model, messages, pass);
  }

  parseJsonOutput(text) {
    if (!text || typeof text !== 'string') {
      throw Object.assign(new Error('Empty LLM response'), { code: 'AGENT_EMPTY_RESPONSE' });
    }

    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    try {
      return JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // Fall through
        }
      }
    }

    throw Object.assign(new Error(`Failed to parse JSON from ${this.agentName} response`), { code: 'AGENT_INVALID_JSON' });
  }

  async notifyStatus(sessionId, status, payload = {}) {
    let userId = payload.userId || null;
    if (!userId && sessionId) {
      try {
        const { getSession } = require('../services/sessionService');
        const session = await getSession(sessionId);
        userId = session?.userId || null;
      } catch {
        // best-effort
      }
    }

    try {
      await axios.post(`${NOTIFICATION_URL}/notifications/publish`, {
        type: 'AGENT_STATUS_CHANGE',
        userId,
        payload: { sessionId, agent: this.agentName, status, ...payload },
      }, {
        headers: { 'X-Internal-Secret': RESOLVED_INTERNAL_SECRET },
        timeout: 5000,
      });
    } catch {
      logger.debug('Failed to send agent notification', { sessionId, agent: this.agentName });
    }
  }

  async retry(fn, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          logger.warn(`${this.agentName} attempt ${attempt + 1} failed, retrying...`, { error: err.message });
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    throw lastError;
  }
}

module.exports = BaseAgent;
