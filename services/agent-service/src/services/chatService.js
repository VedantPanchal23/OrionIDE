/**
 * Freeform agent chat — single-turn LLM + optional Drive file writes.
 */

const { v4: uuidv4 } = require('uuid');
const BaseAgent = require('../agents/baseAgent');
const FileAgent = require('../agents/fileAgent');
const { pushEvent, streamSession } = require('./sseHub');
const { loadProjectRules, appendRules } = require('./projectRules');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');
const fileAgent = new FileAgent();

const chats = new Map(); // sessionId → { userId, ... }

const SYSTEM = `You are Orion IDE's coding assistant inside a cloud IDE backed by Google Drive.
Help the user with code, explain, and when asked to create/edit files, respond with a short answer PLUS a JSON block:

\`\`\`json
{"files":[{"path":"relative/path.ext","content":"...full file contents..."}]}
\`\`\`

Rules:
- Only include the JSON files block when you are writing or updating files.
- Paths are relative to the project root (e.g. src/App.jsx, main.py).
- Prefer complete file contents for new files.
- Be concise. No markdown fences around the whole reply except the optional JSON block.`;

class ChatAgent extends BaseAgent {
  constructor() {
    super('Chat', 'openai/gpt-4o-mini', 'openrouter');
  }

  getSystemPrompt() {
    return SYSTEM;
  }
}

const chatAgent = new ChatAgent();

function extractFiles(text) {
  if (!text) return [];
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : null;
  const candidates = [];
  if (raw) candidates.push(raw);
  const brace = text.match(/\{[\s\S]*"files"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
  if (brace) candidates.push(brace[0]);

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c.trim());
      if (Array.isArray(parsed?.files)) {
        return parsed.files
          .filter((f) => f && typeof f.path === 'string' && typeof f.content === 'string')
          .map((f) => ({
            path: f.path.replace(/^\/+/, '').replace(/\\/g, '/'),
            content: f.content,
          }))
          .slice(0, 20);
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

function stripFilesJson(text) {
  if (!text) return '';
  return text
    .replace(/```json\s*[\s\S]*?```/gi, '')
    .trim();
}

async function startChat(userId, {
  message,
  history = [],
  llm = null,
  projectFolderId = null,
  projectName = null,
  applyFiles = true,
  googleAccessToken = null,
  codeContext = null,
} = {}) {
  const sessionId = uuidv4();
  const record = {
    sessionId,
    userId,
    projectFolderId,
    projectName,
    status: 'running',
    createdAt: new Date().toISOString(),
  };
  chats.set(sessionId, record);

  pushEvent(sessionId, { type: 'CHAT_STARTED', sessionId });

  setImmediate(() => {
    BaseAgent.withLlm(llm || {}, async () => {
      try {
        pushEvent(sessionId, { type: 'CHAT_THINKING' });
        const rules = await loadProjectRules(userId, projectFolderId, googleAccessToken);
        const system = appendRules(chatAgent.getSystemPrompt(), rules);

        const ctx = codeContext ? String(codeContext).slice(0, 4000).trim() : '';
        const userContent = ctx
          ? `${String(message).slice(0, 8000)}\n\n---\n${ctx}`
          : String(message).slice(0, 8000);

        const messages = [
          { role: 'system', content: system },
          ...((Array.isArray(history) ? history : [])
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
            .slice(-12)
            .map((m) => ({ role: m.role, content: String(m.content).slice(0, 8000) }))),
          { role: 'user', content: userContent },
        ];

        const reply = await chatAgent.callLLM(messages, { temperature: 0.3, max_tokens: 4096 });
        const files = extractFiles(reply);
        const content = stripFilesJson(reply) || reply;

        pushEvent(sessionId, {
          type: 'CHAT_COMPLETE',
          content,
          files: files.map((f) => ({ path: f.path, bytes: f.content.length })),
        });

        if (applyFiles && files.length && projectFolderId && googleAccessToken) {
          for (const f of files) {
            try {
              const result = await fileAgent.writeFile(
                userId,
                f.path,
                f.content,
                sessionId,
                projectFolderId,
                googleAccessToken,
              );
              pushEvent(sessionId, {
                type: 'FILE_WRITTEN',
                filePath: f.path,
                fileId: result?.fileId || null,
                success: !!result?.success,
                error: result?.error || null,
              });
            } catch (err) {
              pushEvent(sessionId, {
                type: 'FILE_WRITTEN',
                filePath: f.path,
                success: false,
                error: err.message,
              });
            }
          }
        } else if (files.length && !projectFolderId) {
          pushEvent(sessionId, {
            type: 'CHAT_INFO',
            message: 'Files proposed but no project folder — open a project to apply writes',
            files: files.map((f) => f.path),
          });
        }

        record.status = 'complete';
        pushEvent(sessionId, { type: 'CHAT_DONE' });
      } catch (err) {
        logger.error('Chat failed', { error: err.message });
        record.status = 'failed';
        pushEvent(sessionId, { type: 'CHAT_ERROR', error: err.message });
        pushEvent(sessionId, { type: 'CHAT_DONE' });
      }
    });
  });

  return { sessionId, session: record };
}

function getChat(sessionId) {
  return chats.get(sessionId) || null;
}

module.exports = {
  startChat,
  getChat,
  streamSession,
};
