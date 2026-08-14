/**
 * AI commit message from staged / working-tree summary.
 */

const BaseAgent = require('../agents/baseAgent');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');

const SYSTEM = `You write concise git commit messages.
Return ONLY the commit message text — no quotes, no markdown, no explanation.
Prefer conventional commits when appropriate (feat/fix/docs/refactor/chore).
Keep subject ≤ 72 characters; add a short body only if needed.`;

class CommitMessageAgent extends BaseAgent {
  constructor() {
    super('CommitMessage', 'openai/gpt-4o-mini', 'openrouter');
  }

  getSystemPrompt() {
    return SYSTEM;
  }
}

const agent = new CommitMessageAgent();

async function generateCommitMessage({
  summary = '',
  diff = '',
  llm = null,
  userId = null,
} = {}) {
  const s = String(summary || '').trim().slice(0, 4000);
  const d = String(diff || '').trim().slice(0, 12000);
  if (!s && !d) {
    const err = new Error('summary or diff is required');
    err.code = 'COMMIT_MSG_MISSING_CONTEXT';
    err.status = 400;
    throw err;
  }

  const userContent = [
    s && `Changed files:\n${s}`,
    d && `Diff excerpt:\n${d}`,
  ].filter(Boolean).join('\n\n');

  const text = await BaseAgent.withLlm(llm || {}, async () => {
    const raw = await agent.callLLM([
      { role: 'system', content: agent.getSystemPrompt() },
      { role: 'user', content: userContent },
    ], { temperature: 0.3, maxTokens: 200 });
    return String(raw || '').trim().replace(/^["'`]+|["'`]+$/g, '');
  });

  if (!text) {
    const err = new Error('Empty commit message from model');
    err.code = 'COMMIT_MSG_EMPTY';
    err.status = 502;
    throw err;
  }

  logger.info('Commit message generated', { userId, len: text.length });
  return { message: text };
}

module.exports = { generateCommitMessage };
