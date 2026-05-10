/**
 * Orion IDE — Run Agent
 *
 * Determines the correct execution command for a project
 * and triggers execution via execution-service.
 */

const BaseAgent = require('./baseAgent');
const axios = require('axios');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const EXECUTION_SERVICE_URL = process.env.EXECUTION_SERVICE_URL || 'http://execution-service:3004';

const SYSTEM_PROMPT = `You are the Run Agent for Orion IDE. Determine the correct command to execute the project's main entry file. Output ONLY valid JSON: { "mainFile": string, "pistonLanguage": string, "pistonVersion": string, "runCommand": string, "explanation": string }. pistonLanguage must be one of: python, javascript, typescript, java, c, cpp, csharp, go, rust, php, ruby, kotlin, swift, bash, r, dart, lua, perl. pistonVersion should be "*" for latest.`;

class RunAgent extends BaseAgent {
  constructor() {
    super('RunAgent', 'llama3-8b-8192', 'groq');
  }

  getSystemPrompt() {
    return SYSTEM_PROMPT;
  }

  /**
   * Validate run agent output.
   */
  validateOutput(output) {
    const required = ['mainFile', 'pistonLanguage', 'pistonVersion', 'runCommand', 'explanation'];
    for (const key of required) {
      if (!output[key] && output[key] !== '') {
        throw Object.assign(new Error(`RunAgent output missing: ${key}`), { code: 'AGENT_SCHEMA_ERROR' });
      }
    }
    return output;
  }

  /**
   * Determine the execution command.
   *
   * @param {string} projectGoal
   * @param {object} designerOutput — file structure
   * @param {Array<{path: string, code: string}>} files — all generated files
   * @param {string} sessionId
   * @returns {Promise<object>}
   */
  async determineCommand(projectGoal, designerOutput, files, sessionId) {
    await this.notifyStatus(sessionId, 'thinking', { step: 'runAgent' });

    const fileList = files.map((f) => f.path).join('\n');

    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      {
        role: 'user',
        content: [
          `Project goal: ${projectGoal}`,
          `\nFile structure:\n${fileList}`,
          `\nImplementation order: ${designerOutput.implementationOrder?.join(', ') || 'unknown'}`,
        ].join('\n'),
      },
    ];

    const result = await this.retry(async () => {
      const text = await this.callLLM(messages, { jsonMode: true });
      const parsed = this.parseJsonOutput(text);
      return this.validateOutput(parsed);
    });

    await this.notifyStatus(sessionId, 'complete', { step: 'runAgent', mainFile: result.mainFile });

    logger.info('RunAgent completed', { sessionId, mainFile: result.mainFile, language: result.pistonLanguage });

    return result;
  }

  /**
   * Execute the main file via execution-service.
   *
   * @param {string} userId
   * @param {object} runConfig — { mainFile, pistonLanguage, pistonVersion }
   * @param {string} code — main file content
   * @param {string} sessionId
   * @returns {Promise<object>}
   */
  async execute(userId, runConfig, code, sessionId) {
    await this.notifyStatus(sessionId, 'thinking', { step: 'execute' });

    try {
      const res = await axios.post(`${EXECUTION_SERVICE_URL}/execute`, {
        language: runConfig.pistonLanguage,
        fileName: runConfig.mainFile,
        code,
      }, {
        headers: { 'X-User-Id': userId },
        timeout: 45000,
      });

      const executionId = res.data?.data?.executionId;

      // Wait briefly for execution to complete, then fetch result
      await new Promise((r) => setTimeout(r, 3000));

      let result;
      try {
        const resultRes = await axios.get(`${EXECUTION_SERVICE_URL}/execute/${executionId}/result`, {
          headers: { 'X-User-Id': userId },
          timeout: 10000,
        });
        result = resultRes.data?.data;
      } catch {
        result = { executionId, status: 'pending' };
      }

      await this.notifyStatus(sessionId, 'complete', {
        step: 'execute',
        executionId,
        exitCode: result?.exitCode,
      });

      logger.info('Execution triggered', { sessionId, executionId });

      return { executionId, ...result };
    } catch (err) {
      logger.error('Execution failed', { sessionId, error: err.message });
      throw Object.assign(new Error(`Execution failed: ${err.message}`), { code: 'EXEC_FAILED' });
    }
  }
}

module.exports = RunAgent;
