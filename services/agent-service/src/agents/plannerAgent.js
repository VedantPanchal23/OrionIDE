/**
 * Orion IDE — Planner Agent
 *
 * Receives a user's project goal and produces a structured development plan.
 */

const BaseAgent = require('./baseAgent');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const SYSTEM_PROMPT = `You are the Planner agent for Orion IDE. Receive a user's project goal and produce a structured development plan. Output ONLY valid JSON matching this exact schema: { "projectName": string, "description": string, "techStack": string[], "fileStructure": [{"path": string, "purpose": string}], "buildOrder": string[], "estimatedFiles": number }. No explanation. No markdown. Only JSON.`;

class PlannerAgent extends BaseAgent {
  constructor() {
    super('Planner', 'llama-3.3-70b-versatile', 'groq');
  }

  getSystemPrompt() {
    return SYSTEM_PROMPT;
  }

  /**
   * Validate that the planner output matches the required schema.
   */
  validateOutput(output) {
    const required = ['projectName', 'description', 'techStack', 'fileStructure', 'buildOrder', 'estimatedFiles'];
    for (const key of required) {
      if (output[key] === undefined) {
        throw Object.assign(new Error(`Planner output missing required field: ${key}`), { code: 'AGENT_SCHEMA_ERROR' });
      }
    }

    if (!Array.isArray(output.techStack)) throw Object.assign(new Error('techStack must be an array'), { code: 'AGENT_SCHEMA_ERROR' });
    if (!Array.isArray(output.fileStructure)) throw Object.assign(new Error('fileStructure must be an array'), { code: 'AGENT_SCHEMA_ERROR' });
    if (!Array.isArray(output.buildOrder)) throw Object.assign(new Error('buildOrder must be an array'), { code: 'AGENT_SCHEMA_ERROR' });
    if (typeof output.estimatedFiles !== 'number') throw Object.assign(new Error('estimatedFiles must be a number'), { code: 'AGENT_SCHEMA_ERROR' });

    for (const file of output.fileStructure) {
      if (!file.path || !file.purpose) {
        throw Object.assign(new Error('Each fileStructure entry must have path and purpose'), { code: 'AGENT_SCHEMA_ERROR' });
      }
    }

    return output;
  }

  /**
   * Run the planner agent.
   *
   * @param {string} goal — user's project goal
   * @param {string} sessionId
   * @param {string} [rejectionFeedback] — feedback from a previous rejection
   * @returns {Promise<object>} — validated plan
   */
  async run(goal, sessionId, rejectionFeedback) {
    await this.notifyStatus(sessionId, 'thinking', { step: 'planner' });

    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: `Goal: ${goal}` },
    ];

    if (rejectionFeedback) {
      messages.push({
        role: 'user',
        content: `The previous plan was rejected. Feedback: "${rejectionFeedback}". Please generate an improved plan addressing this feedback.`,
      });
    }

    const result = await this.retry(async () => {
      const text = await this.callLLM(messages, { jsonMode: true });
      const parsed = this.parseJsonOutput(text);
      return this.validateOutput(parsed);
    });

    await this.notifyStatus(sessionId, 'complete', { step: 'planner' });

    logger.info('Planner completed', {
      sessionId,
      projectName: result.projectName,
      files: result.estimatedFiles,
    });

    return result;
  }
}

module.exports = PlannerAgent;
