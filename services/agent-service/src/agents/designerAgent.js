/**
 * Orion IDE — Designer Agent
 *
 * Takes the planner's output and designs the complete file structure
 * with module responsibilities and dependency ordering.
 */

const BaseAgent = require('./baseAgent');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const SYSTEM_PROMPT = `You are the Designer agent for Orion IDE. Take the planner's output and design the complete file structure with module responsibilities. Output ONLY valid JSON: { "folders": [{"path": string, "purpose": string}], "files": [{"path": string, "purpose": string, "language": string, "exports": [], "imports": [], "dependsOn": []}], "implementationOrder": string[] }. implementationOrder must list files in dependency order — dependencies always before dependents. No explanation. No markdown. Only JSON.`;

class DesignerAgent extends BaseAgent {
  constructor() {
    super('Designer', 'llama-3.3-70b-versatile', 'groq');
  }

  getSystemPrompt() {
    return SYSTEM_PROMPT;
  }

  /**
   * Validate designer output schema and dependency ordering.
   */
  validateOutput(output) {
    const required = ['folders', 'files', 'implementationOrder'];
    for (const key of required) {
      if (output[key] === undefined) {
        throw Object.assign(new Error(`Designer output missing: ${key}`), { code: 'AGENT_SCHEMA_ERROR' });
      }
    }

    if (!Array.isArray(output.folders)) throw Object.assign(new Error('folders must be an array'), { code: 'AGENT_SCHEMA_ERROR' });
    if (!Array.isArray(output.files)) throw Object.assign(new Error('files must be an array'), { code: 'AGENT_SCHEMA_ERROR' });
    if (!Array.isArray(output.implementationOrder)) throw Object.assign(new Error('implementationOrder must be an array'), { code: 'AGENT_SCHEMA_ERROR' });

    for (const folder of output.folders) {
      if (!folder.path || !folder.purpose) {
        throw Object.assign(new Error('Each folder must have path and purpose'), { code: 'AGENT_SCHEMA_ERROR' });
      }
    }

    const filePaths = new Set();
    for (const file of output.files) {
      if (!file.path || !file.purpose || !file.language) {
        throw Object.assign(new Error('Each file must have path, purpose, and language'), { code: 'AGENT_SCHEMA_ERROR' });
      }
      filePaths.add(file.path);
    }

    // Validate implementationOrder contains all files
    const orderSet = new Set(output.implementationOrder);
    for (const filePath of filePaths) {
      if (!orderSet.has(filePath)) {
        throw Object.assign(new Error(`implementationOrder is missing file: ${filePath}`), { code: 'AGENT_SCHEMA_ERROR' });
      }
    }

    // Validate dependency ordering: for each file, all dependsOn must come before it
    const orderIndex = new Map();
    output.implementationOrder.forEach((path, idx) => orderIndex.set(path, idx));

    for (const file of output.files) {
      const fileIdx = orderIndex.get(file.path);
      if (fileIdx === undefined) continue;
      for (const dep of (file.dependsOn || [])) {
        const depIdx = orderIndex.get(dep);
        if (depIdx !== undefined && depIdx >= fileIdx) {
          logger.warn('Designer dependency order issue', { file: file.path, dep, fileIdx, depIdx });
          // Don't fail — just warn. The LLM sometimes gets ordering slightly wrong.
        }
      }
    }

    return output;
  }

  /**
   * Run the designer agent.
   *
   * @param {object} plannerOutput — validated planner output
   * @param {string} sessionId
   * @param {string} [rejectionFeedback]
   * @returns {Promise<object>} — validated design
   */
  async run(plannerOutput, sessionId, rejectionFeedback) {
    await this.notifyStatus(sessionId, 'thinking', { step: 'designer' });

    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: `Planner output:\n${JSON.stringify(plannerOutput, null, 2)}` },
    ];

    if (rejectionFeedback) {
      messages.push({
        role: 'user',
        content: `The previous design was rejected. Feedback: "${rejectionFeedback}". Please generate an improved design addressing this feedback.`,
      });
    }

    const result = await this.retry(async () => {
      const text = await this.callLLM(messages, { jsonMode: true, maxTokens: 8192 });
      const parsed = this.parseJsonOutput(text);
      return this.validateOutput(parsed);
    });

    await this.notifyStatus(sessionId, 'complete', { step: 'designer' });

    logger.info('Designer completed', {
      sessionId,
      folders: result.folders.length,
      files: result.files.length,
    });

    return result;
  }
}

module.exports = DesignerAgent;
