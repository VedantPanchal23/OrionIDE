/**
 * Orion IDE — Implementer Agent
 *
 * Writes complete, production-quality code for each file in the design.
 * Uses DeepSeek Coder via OpenRouter for code generation.
 */

const BaseAgent = require('./baseAgent');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const SYSTEM_PROMPT = `You are the Implementer agent for Orion IDE. Write complete, production-quality code for the specified file. Use the project context provided. Output ONLY the raw code. No markdown fences. No explanation. Just the code file content.`;

class ImplementerAgent extends BaseAgent {
  constructor() {
    super('Implementer', 'deepseek/deepseek-coder-v2:free', 'openrouter');
  }

  getSystemPrompt() {
    return SYSTEM_PROMPT;
  }

  /**
   * Strip markdown code fences if the LLM wraps output.
   */
  cleanCode(text) {
    if (!text) return '';
    let cleaned = text.trim();
    // Remove opening fence
    cleaned = cleaned.replace(/^```[\w]*\s*\n?/, '');
    // Remove closing fence
    cleaned = cleaned.replace(/\n?```\s*$/, '');
    return cleaned.trim();
  }

  /**
   * Generate code for a single file.
   *
   * @param {object} designerOutput — full designer output
   * @param {number} fileIndex — index in designerOutput.files
   * @param {Array<{path: string, code: string}>} previousFiles — already-written files
   * @param {string} sessionId
   * @param {string} [reviewFeedback] — feedback from reviewer rejection
   * @returns {Promise<{ filePath: string, language: string, code: string }>}
   */
  async runFile(designerOutput, fileIndex, previousFiles, sessionId, reviewFeedback) {
    const fileSpec = designerOutput.files[fileIndex];
    if (!fileSpec) throw Object.assign(new Error(`File index ${fileIndex} out of range`), { code: 'AGENT_INVALID_FILE' });

    await this.notifyStatus(sessionId, 'thinking', { step: 'implementer', file: fileSpec.path });

    const contextLines = [
      `Project: ${designerOutput.projectName || 'Untitled'}`,
      `File to implement: ${fileSpec.path}`,
      `Language: ${fileSpec.language}`,
      `Purpose: ${fileSpec.purpose}`,
      `Exports: ${(fileSpec.exports || []).join(', ') || 'none'}`,
      `Imports: ${(fileSpec.imports || []).join(', ') || 'none'}`,
      `Dependencies: ${(fileSpec.dependsOn || []).join(', ') || 'none'}`,
    ];

    if (previousFiles.length > 0) {
      contextLines.push('\n--- Previously written files (for reference) ---');
      for (const pf of previousFiles) {
        contextLines.push(`\n// === ${pf.path} ===`);
        contextLines.push(pf.code);
      }
    }

    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: contextLines.join('\n') },
    ];

    if (reviewFeedback) {
      messages.push({
        role: 'user',
        content: `The previous implementation was rejected by the Reviewer. Feedback: "${reviewFeedback}". Please rewrite the file addressing all issues.`,
      });
    }

    const result = await this.retry(async () => {
      const text = await this.callLLM(messages, { maxTokens: 8192, temperature: 0.2 });
      const code = this.cleanCode(text);
      if (!code || code.length < 5) {
        throw Object.assign(new Error('Implementer returned empty code'), { code: 'AGENT_EMPTY_CODE' });
      }
      return code;
    }, 1);

    await this.notifyStatus(sessionId, 'complete', { step: 'implementer', file: fileSpec.path });

    logger.info('Implementer completed', { sessionId, file: fileSpec.path, codeLength: result.length });

    return {
      filePath: fileSpec.path,
      language: fileSpec.language,
      code: result,
    };
  }
}

module.exports = ImplementerAgent;
