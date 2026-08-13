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
const SERVICE_SECRET =
  process.env.INTERNAL_SECRET || process.env.DRIVE_SERVICE_SECRET || '';

const meshHeaders = (userId) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
  };
  if (SERVICE_SECRET) headers['X-Internal-Secret'] = SERVICE_SECRET;
  return headers;
};

const SYSTEM_PROMPT = `You are the Run Agent for Orion IDE. Determine the correct command to execute the project's main entry file. Output ONLY valid JSON: { "mainFile": string, "pistonLanguage": string, "pistonVersion": string, "runCommand": string, "explanation": string }. pistonLanguage must be one of: python, javascript, typescript, java, c, cpp, csharp, go, rust, php, ruby, kotlin, swift, bash, r, dart, lua, perl. pistonVersion should be "*" for latest.`;

class RunAgent extends BaseAgent {
  constructor() {
    // Groq deprecated llama3-8b-8192; use a currently supported model.
    super('RunAgent', 'llama-3.1-8b-instant', 'groq');
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
        languageId: runConfig.pistonLanguage,
        fileName: runConfig.mainFile,
        code,
      }, {
        headers: meshHeaders(userId),
        timeout: 45000,
      });

      const executionId = res.data?.data?.executionId;

      // Poll execution result until finished (up to ~30 s)
      let result;
      const MAX_POLLS = 10;
      const POLL_INTERVAL = 3000;
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        try {
          const resultRes = await axios.get(`${EXECUTION_SERVICE_URL}/execute/${executionId}/result`, {
            headers: meshHeaders(userId),
            timeout: 10000,
          });
          result = resultRes.data?.data;
          if (result && result.status !== 'running' && result.exitCode !== undefined && result.exitCode !== null) {
            break;
          }
        } catch {
          // not ready yet
        }
      }
      if (!result) {
        result = { executionId, status: 'timeout' };
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
