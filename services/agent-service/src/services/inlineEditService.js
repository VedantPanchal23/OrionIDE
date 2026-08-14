/**
 * Ctrl/Cmd+K inline edit — synchronous LLM rewrite of a code selection.
 */

const BaseAgent = require('../agents/baseAgent');
const { loadProjectRules, appendRules } = require('./projectRules');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const SYSTEM = `You are Orion IDE's inline code editor.
The user will give an instruction and a code selection (or current line).
Return ONLY the replacement code for that selection — no markdown fences, no explanation, no surrounding prose.
Preserve indentation style of the original. Do not expand scope beyond what was asked.`;

class InlineEditAgent extends BaseAgent {
  constructor() {
    super('InlineEdit', 'openai/gpt-4o-mini', 'openrouter');
  }

  getSystemPrompt() {
    return SYSTEM;
  }
}

const agent = new InlineEditAgent();

function stripFences(text) {
  if (!text) return '';
  let t = String(text).trim();
  const m = t.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$/);
  if (m) t = m[1];
  return t.replace(/\s+$/, '');
}

/**
 * @returns {Promise<{ edited: string, explanation: string|null }>}
 */
async function runInlineEdit({
  instruction,
  code,
  language = '',
  filePath = '',
  surrounding = '',
  llm = null,
  projectFolderId = null,
  googleAccessToken = null,
  userId = null,
} = {}) {
  const instr = String(instruction || '').trim();
  const selection = String(code ?? '');
  if (!instr) {
    const err = new Error('instruction is required');
    err.code = 'INLINE_MISSING_INSTRUCTION';
    err.status = 400;
    throw err;
  }
  if (selection.length > 40000) {
    const err = new Error('selection too large (max 40000 chars)');
    err.code = 'INLINE_SELECTION_TOO_LARGE';
    err.status = 400;
    throw err;
  }

  let rules = '';
  if (projectFolderId && googleAccessToken) {
    try {
      rules = await loadProjectRules(userId, projectFolderId, googleAccessToken);
    } catch (err) {
      logger.debug('inline edit: could not load project rules', { error: err.message });
    }
  }

  const system = appendRules(agent.getSystemPrompt(), rules);
  const userParts = [
    `Instruction: ${instr}`,
    language ? `Language: ${language}` : null,
    filePath ? `File: ${filePath}` : null,
    surrounding ? `Surrounding context (do not rewrite this; for reference only):\n\`\`\`\n${String(surrounding).slice(0, 8000)}\n\`\`\`` : null,
    `Selection to replace:\n\`\`\`\n${selection}\n\`\`\``,
  ].filter(Boolean);

  const edited = await BaseAgent.withLlm(llm || {}, async () => {
    const raw = await agent.callLLM([
      { role: 'system', content: system },
      { role: 'user', content: userParts.join('\n\n') },
    ], { temperature: 0.2, maxTokens: 4096 });
    return stripFences(raw);
  });

  if (!edited && edited !== '') {
    const err = new Error('Empty model response');
    err.code = 'INLINE_EMPTY_RESPONSE';
    err.status = 502;
    throw err;
  }

  logger.info('Inline edit completed', {
    userId,
    language,
    filePath,
    inLen: selection.length,
    outLen: edited.length,
  });

  return { edited, explanation: null };
}

module.exports = { runInlineEdit };
