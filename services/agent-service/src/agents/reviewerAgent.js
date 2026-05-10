/**
 * Orion IDE — Reviewer Agent
 *
 * Reviews generated code for quality, correctness, and best practices.
 * Uses llama3-8b for fast review cycles.
 */

const BaseAgent = require('./baseAgent');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const SYSTEM_PROMPT = `You are the Reviewer agent for Orion IDE. Review the provided code file. Output ONLY valid JSON: { "approved": boolean, "score": number (1-10), "issues": [{"severity": "critical"|"warning"|"suggestion", "description": string, "line": number|null}], "summary": string }. Be strict but fair. Score 7+ means approved. No explanation outside JSON.`;

class ReviewerAgent extends BaseAgent {
  constructor() {
    super('Reviewer', 'llama3-8b-8192', 'groq');
  }

  getSystemPrompt() {
    return SYSTEM_PROMPT;
  }

  /**
   * Validate reviewer output schema.
   */
  validateOutput(output) {
    if (typeof output.approved !== 'boolean') {
      throw Object.assign(new Error('Reviewer output must have boolean approved'), { code: 'AGENT_SCHEMA_ERROR' });
    }
    if (typeof output.score !== 'number' || output.score < 1 || output.score > 10) {
      throw Object.assign(new Error('Reviewer score must be 1-10'), { code: 'AGENT_SCHEMA_ERROR' });
    }
    if (!Array.isArray(output.issues)) {
      throw Object.assign(new Error('Reviewer issues must be an array'), { code: 'AGENT_SCHEMA_ERROR' });
    }
    if (typeof output.summary !== 'string') {
      throw Object.assign(new Error('Reviewer summary must be a string'), { code: 'AGENT_SCHEMA_ERROR' });
    }

    for (const issue of output.issues) {
      if (!['critical', 'warning', 'suggestion'].includes(issue.severity)) {
        issue.severity = 'suggestion';
      }
      if (!issue.description) {
        issue.description = 'No description';
      }
    }

    return output;
  }

  /**
   * Review a code file.
   *
   * @param {string} filePath
   * @param {string} code
   * @param {string} language
   * @param {string} purpose
   * @param {string} sessionId
   * @returns {Promise<{ approved, score, issues, summary }>}
   */
  async review(filePath, code, language, purpose, sessionId) {
    await this.notifyStatus(sessionId, 'thinking', { step: 'reviewer', file: filePath });

    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      {
        role: 'user',
        content: [
          `File: ${filePath}`,
          `Language: ${language}`,
          `Purpose: ${purpose}`,
          `\nCode:\n${code}`,
        ].join('\n'),
      },
    ];

    const result = await this.retry(async () => {
      const text = await this.callLLM(messages, { jsonMode: true, maxTokens: 2048 });
      const parsed = this.parseJsonOutput(text);
      return this.validateOutput(parsed);
    });

    await this.notifyStatus(sessionId, 'complete', {
      step: 'reviewer',
      file: filePath,
      approved: result.approved,
      score: result.score,
    });

    logger.info('Reviewer completed', {
      sessionId,
      file: filePath,
      approved: result.approved,
      score: result.score,
      issues: result.issues.length,
    });

    return result;
  }
}

module.exports = ReviewerAgent;
