/**
 * Orion IDE — Base Agent
 *
 * Abstract base class for all pipeline agents.
 */

const groqService = require('../services/groqService');
const openRouterService = require('../services/openRouterService');
const axios = require('axios');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'orion-internal-secret-dev';

class BaseAgent {
  constructor(agentName, model, provider = 'groq') {
    if (new.target === BaseAgent) throw new Error('BaseAgent is abstract');
    this.agentName = agentName;
    this.model = model;
    this.provider = provider;
  }

  /**
   * Must be implemented by subclass.
   */
  async run(input, sessionId) {
    throw new Error(`${this.agentName}.run() not implemented`);
  }

  /**
   * Must be implemented by subclass.
   */
  getSystemPrompt() {
    throw new Error(`${this.agentName}.getSystemPrompt() not implemented`);
  }

  /**
   * Call the configured LLM provider.
   */
  async callLLM(messages, options = {}) {
    if (this.provider === 'openrouter') {
      return openRouterService.chat(this.model, messages, options);
    }
    return groqService.chat(this.model, messages, options);
  }

  /**
   * Extract and parse JSON from LLM response text.
   * Handles markdown code fences, leading text, etc.
   */
  parseJsonOutput(text) {
    if (!text || typeof text !== 'string') {
      throw Object.assign(new Error('Empty LLM response'), { code: 'AGENT_EMPTY_RESPONSE' });
    }

    // Remove markdown code fences
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    // Try direct parse
    try {
      return JSON.parse(cleaned);
    } catch {
      // Try extracting JSON object from surrounding text
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

  /**
   * Publish a status update to the notification service.
   */
  async notifyStatus(sessionId, status, payload = {}) {
    try {
      await axios.post(`${NOTIFICATION_URL}/notifications/publish`, {
        type: 'AGENT_STATUS_CHANGE',
        userId: payload.userId || null,
        payload: { sessionId, agent: this.agentName, status, ...payload },
      }, {
        headers: { 'X-Internal-Secret': INTERNAL_SECRET },
        timeout: 5000,
      });
    } catch {
      // Non-fatal — notification delivery is best-effort
      logger.debug('Failed to send agent notification', { sessionId, agent: this.agentName });
    }
  }

  /**
   * Retry wrapper with configurable attempts.
   */
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
