/**
 * Orion IDE — Agent Routes
 */

const express = require('express');
const { startPipeline, approveStep, rejectStep, cancelPipeline, streamSession } = require('../services/pipelineService');
const { startChat, getChat, streamSession: streamChat } = require('../services/chatService');
const { runInlineEdit } = require('../services/inlineEditService');
const { generateCommitMessage } = require('../services/commitMessageService');
const { getSession, toPublicSession } = require('../services/sessionService');
const { probeLlm } = require('../services/llmProbe');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('agent-service');
const router = express.Router();

router.use((req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Missing X-User-Id header', details: null },
    });
  }
  req.userId = userId;
  req.googleAccessToken = req.headers['x-google-access-token'] || null;
  next();
});

// POST /agents/llm/probe — validate BYOK credentials
router.post('/llm/probe', async (req, res) => {
  try {
    const { provider, apiKey, model, baseUrl } = req.body || {};
    const data = await probeLlm({ provider, apiKey, model, baseUrl });
    res.json({ data, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    const status = err.status || (err.code === 'LLM_MISSING_KEY' ? 400 : 502);
    logger.warn('LLM probe failed', { error: err.message, code: err.code });
    res.status(status).json({
      error: {
        code: err.code || 'LLM_PROBE_FAILED',
        message: err.message || 'Could not reach LLM provider',
        details: null,
      },
    });
  }
});

const assertSessionOwner = async (sessionId, userId) => {
  const session = await getSession(sessionId);
  if (!session) {
    const err = new Error('Session not found');
    err.code = 'PIPELINE_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (session.userId !== userId) {
    const err = new Error('Not your pipeline session');
    err.code = 'PIPELINE_FORBIDDEN';
    err.status = 403;
    throw err;
  }
  return session;
};

// POST /agents/pipeline/start
router.post('/pipeline/start', async (req, res) => {
  try {
    const { goal, llm, projectFolderId, projectName } = req.body || {};
    if (!goal || goal.trim().length === 0) {
      return res.status(400).json({ error: { code: 'AGENT_MISSING_GOAL', message: 'goal is required', details: null } });
    }
    if (goal.length > 500) {
      return res.status(400).json({ error: { code: 'AGENT_GOAL_TOO_LONG', message: 'goal must be 500 characters or less', details: null } });
    }
    if (!req.googleAccessToken) {
      return res.status(401).json({
        error: {
          code: 'DRIVE_TOKEN_REQUIRED',
          message: 'Google Drive token required — re-login before starting an agent pipeline',
          details: null,
        },
      });
    }

    const llmConfig = llm && typeof llm === 'object'
      ? {
        provider: String(llm.provider || 'openrouter').slice(0, 32),
        model: String(llm.model || '').slice(0, 120),
        apiKey: llm.apiKey ? String(llm.apiKey).slice(0, 512) : null,
        baseUrl: llm.baseUrl ? String(llm.baseUrl).slice(0, 300) : null,
      }
      : null;

    if (llmConfig && !llmConfig.apiKey) {
      return res.status(400).json({
        error: {
          code: 'LLM_KEY_REQUIRED',
          message: 'API key missing in llm config — clear llm or provide apiKey',
          details: null,
        },
      });
    }

    const { sessionId, session } = await startPipeline(req.userId, goal.trim(), {
      googleAccessToken: req.googleAccessToken,
      llm: llmConfig,
      projectFolderId: projectFolderId ? String(projectFolderId) : null,
      projectName: projectName ? String(projectName).slice(0, 120) : null,
    });
    res.status(201).json({
      data: { sessionId, session: toPublicSession(session) },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    logger.error('Start pipeline failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// GET /agents/pipeline/:sessionId
router.get('/pipeline/:sessionId', async (req, res) => {
  try {
    const session = await assertSessionOwner(req.params.sessionId, req.userId);
    res.json({ data: toPublicSession(session) });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: null } });
    }
    logger.error('Get session failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// POST /agents/pipeline/:sessionId/approve
router.post('/pipeline/:sessionId/approve', async (req, res) => {
  try {
    await assertSessionOwner(req.params.sessionId, req.userId);
    const { step } = req.body;
    if (!step) {
      return res.status(400).json({ error: { code: 'AGENT_MISSING_STEP', message: 'step is required', details: null } });
    }
    const session = await approveStep(req.params.sessionId, parseInt(step, 10));
    res.json({ data: session });
  } catch (err) {
    if (err.status || err.code === 'PIPELINE_NOT_FOUND') {
      return res.status(err.status || 404).json({ error: { code: err.code, message: err.message, details: null } });
    }
    logger.error('Approve step failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// POST /agents/pipeline/:sessionId/reject
router.post('/pipeline/:sessionId/reject', async (req, res) => {
  try {
    await assertSessionOwner(req.params.sessionId, req.userId);
    const { step, reason } = req.body;
    if (!step || !reason) {
      return res.status(400).json({ error: { code: 'AGENT_MISSING_PARAM', message: 'step and reason are required', details: null } });
    }
    const session = await rejectStep(req.params.sessionId, parseInt(step, 10), reason);
    res.json({ data: session });
  } catch (err) {
    if (err.status || err.code === 'PIPELINE_NOT_FOUND') {
      return res.status(err.status || 404).json({ error: { code: err.code, message: err.message, details: null } });
    }
    logger.error('Reject step failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// POST /agents/pipeline/:sessionId/cancel — stop in-flight pipeline
router.post('/pipeline/:sessionId/cancel', async (req, res) => {
  try {
    await assertSessionOwner(req.params.sessionId, req.userId);
    const session = await cancelPipeline(req.params.sessionId);
    res.json({ data: toPublicSession(session) });
  } catch (err) {
    if (err.status || err.code === 'PIPELINE_NOT_FOUND') {
      return res.status(err.status || 404).json({ error: { code: err.code, message: err.message, details: null } });
    }
    logger.error('Cancel pipeline failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// GET /agents/pipeline/:sessionId/stream — SSE
router.get('/pipeline/:sessionId/stream', async (req, res) => {
  try {
    await assertSessionOwner(req.params.sessionId, req.userId);
    streamSession(res, req.params.sessionId);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: null } });
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// POST /agents/chat — freeform coding chat (BYOK)
router.post('/chat', async (req, res) => {
  try {
    const {
      message, history, llm, projectFolderId, projectName, applyFiles, codeContext,
    } = req.body || {};
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        error: { code: 'AGENT_MISSING_MESSAGE', message: 'message is required', details: null },
      });
    }
    if (String(message).length > 8000) {
      return res.status(400).json({
        error: { code: 'AGENT_MESSAGE_TOO_LONG', message: 'message must be 8000 characters or less', details: null },
      });
    }

    const llmConfig = llm && typeof llm === 'object'
      ? {
        provider: String(llm.provider || 'openrouter').slice(0, 32),
        model: String(llm.model || '').slice(0, 120),
        apiKey: llm.apiKey ? String(llm.apiKey).slice(0, 512) : null,
        baseUrl: llm.baseUrl ? String(llm.baseUrl).slice(0, 300) : null,
      }
      : null;

    if (llmConfig && !llmConfig.apiKey) {
      return res.status(400).json({
        error: {
          code: 'LLM_KEY_REQUIRED',
          message: 'API key missing in llm config',
          details: null,
        },
      });
    }

    const { sessionId, session } = await startChat(req.userId, {
      message: String(message).trim(),
      history: Array.isArray(history) ? history : [],
      llm: llmConfig,
      projectFolderId: projectFolderId ? String(projectFolderId) : null,
      projectName: projectName ? String(projectName).slice(0, 120) : null,
      applyFiles: applyFiles !== false,
      googleAccessToken: req.googleAccessToken,
      codeContext: codeContext ? String(codeContext).slice(0, 4000) : null,
    });

    res.status(201).json({
      data: { sessionId, session },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    logger.error('Start chat failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// POST /agents/commit-message — AI commit message from status/diff summary
router.post('/commit-message', async (req, res) => {
  try {
    const { summary, diff, llm } = req.body || {};
    const llmConfig = llm && typeof llm === 'object'
      ? {
        provider: String(llm.provider || 'openrouter').slice(0, 32),
        model: String(llm.model || '').slice(0, 120),
        apiKey: llm.apiKey ? String(llm.apiKey).slice(0, 512) : null,
        baseUrl: llm.baseUrl ? String(llm.baseUrl).slice(0, 300) : null,
      }
      : null;
    if (llmConfig && !llmConfig.apiKey) {
      return res.status(400).json({
        error: { code: 'LLM_KEY_REQUIRED', message: 'API key missing in llm config', details: null },
      });
    }
    const result = await generateCommitMessage({
      summary,
      diff,
      llm: llmConfig,
      userId: req.userId,
    });
    res.json({ data: result, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    const status = err.status || 500;
    logger.error('Commit message failed', { error: err.message, code: err.code });
    res.status(status).json({
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message, details: null },
    });
  }
});

// POST /agents/inline-edit — Ctrl/Cmd+K selection rewrite (BYOK)
router.post('/inline-edit', async (req, res) => {
  try {
    const {
      instruction, code, language, filePath, surrounding, llm, projectFolderId,
    } = req.body || {};
    if (!instruction || !String(instruction).trim()) {
      return res.status(400).json({
        error: { code: 'INLINE_MISSING_INSTRUCTION', message: 'instruction is required', details: null },
      });
    }
    if (String(instruction).length > 2000) {
      return res.status(400).json({
        error: { code: 'INLINE_INSTRUCTION_TOO_LONG', message: 'instruction must be 2000 characters or less', details: null },
      });
    }
    if (code == null) {
      return res.status(400).json({
        error: { code: 'INLINE_MISSING_CODE', message: 'code (selection) is required', details: null },
      });
    }

    const llmConfig = llm && typeof llm === 'object'
      ? {
        provider: String(llm.provider || 'openrouter').slice(0, 32),
        model: String(llm.model || '').slice(0, 120),
        apiKey: llm.apiKey ? String(llm.apiKey).slice(0, 512) : null,
        baseUrl: llm.baseUrl ? String(llm.baseUrl).slice(0, 300) : null,
      }
      : null;

    if (llmConfig && !llmConfig.apiKey) {
      return res.status(400).json({
        error: { code: 'LLM_KEY_REQUIRED', message: 'API key missing in llm config', details: null },
      });
    }

    const result = await runInlineEdit({
      instruction: String(instruction).trim(),
      code: String(code),
      language: language ? String(language).slice(0, 64) : '',
      filePath: filePath ? String(filePath).slice(0, 400) : '',
      surrounding: surrounding ? String(surrounding).slice(0, 8000) : '',
      llm: llmConfig,
      projectFolderId: projectFolderId ? String(projectFolderId) : null,
      googleAccessToken: req.googleAccessToken,
      userId: req.userId,
    });

    res.json({
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    const status = err.status || 500;
    logger.error('Inline edit failed', { error: err.message, code: err.code });
    res.status(status).json({
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message,
        details: null,
      },
    });
  }
});

// GET /agents/chat/:sessionId/stream — SSE
router.get('/chat/:sessionId/stream', async (req, res) => {
  try {
    const chat = getChat(req.params.sessionId);
    if (!chat) {
      return res.status(404).json({ error: { code: 'CHAT_NOT_FOUND', message: 'Chat session not found', details: null } });
    }
    if (chat.userId !== req.userId) {
      return res.status(403).json({ error: { code: 'CHAT_FORBIDDEN', message: 'Not your chat session', details: null } });
    }
    streamChat(res, req.params.sessionId);
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

module.exports = router;
