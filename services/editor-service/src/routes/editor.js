/**
 * Orion IDE — Editor Service Routes
 */

const express = require('express');
const { openFile, closeFile, getSession, setActiveFile, markDirty } = require('../services/sessionService');
const problemsService = require('../services/problemsService');
const debugService = require('../services/debugService');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('editor-service');
const router = express.Router();

// Catalog is public (no user context required)
router.get('/debug/adapters', (_req, res) => {
  res.json({
    data: {
      adapters: [
        { type: 'python', engine: 'debugpy', transport: 'dap-stdio' },
        { type: 'node', engine: 'inspector', transport: 'cdp-websocket' },
      ],
    },
  });
});

// Extract user ID from headers (set by API Gateway)
router.use((req, res, next) => {
  req.userId = req.headers['x-user-id'];
  if (!req.userId) {
    return res.status(401).json({ error: { code: 'EDITOR_NO_AUTH', message: 'Missing user context', details: null } });
  }
  next();
});

// POST /editor/session/open
router.post('/session/open', async (req, res) => {
  try {
    const { fileId, fileName, language } = req.body;
    if (!fileId || !fileName) {
      return res.status(400).json({ error: { code: 'EDITOR_MISSING_PARAM', message: 'fileId and fileName are required', details: null } });
    }
    const session = await openFile(req.userId, fileId, fileName, language);
    res.json({ data: session });
  } catch (err) {
    logger.error('open file failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// DELETE /editor/session/close/:fileId
router.delete('/session/close/:fileId', async (req, res) => {
  try {
    const session = await closeFile(req.userId, req.params.fileId);
    res.json({ data: session });
  } catch (err) {
    logger.error('close file failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// GET /editor/session/state
router.get('/session/state', async (req, res) => {
  try {
    const session = await getSession(req.userId);
    res.json({ data: session });
  } catch (err) {
    logger.error('get session failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// PATCH /editor/session/active
router.patch('/session/active', async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: { code: 'EDITOR_MISSING_PARAM', message: 'fileId is required', details: null } });
    }
    const session = await setActiveFile(req.userId, fileId);
    res.json({ data: session });
  } catch (err) {
    logger.error('set active failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// PATCH /editor/session/dirty
router.patch('/session/dirty', async (req, res) => {
  try {
    const { fileId, isDirty } = req.body;
    if (!fileId || isDirty === undefined) {
      return res.status(400).json({ error: { code: 'EDITOR_MISSING_PARAM', message: 'fileId and isDirty are required', details: null } });
    }
    const session = await markDirty(req.userId, fileId, isDirty);
    res.json({ data: session });
  } catch (err) {
    logger.error('mark dirty failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// ── Problems (diagnostics) ───────────────────────────────────────────────

// PUT /editor/problems — replace all project diagnostics
router.put('/problems', async (req, res) => {
  try {
    const projectId = req.body?.projectId || req.headers['x-project-id'] || 'default';
    const files = req.body?.files;
    if (!Array.isArray(files)) {
      return res.status(400).json({
        error: { code: 'EDITOR_MISSING_PARAM', message: 'files[] required', details: null },
      });
    }
    const data = await problemsService.setProblems(req.userId, projectId, files);
    res.json({ data: { ...data, summary: problemsService.summarize(data) } });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// PUT /editor/problems/:fileId — single file markers
router.put('/problems/:fileId', async (req, res) => {
  try {
    const projectId = req.body?.projectId || req.headers['x-project-id'] || 'default';
    const data = await problemsService.setFileProblems(
      req.userId,
      projectId,
      req.params.fileId,
      req.body?.filePath,
      req.body?.diagnostics || []
    );
    res.json({ data: { ...data, summary: problemsService.summarize(data) } });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// GET /editor/problems?projectId=
router.get('/problems', async (req, res) => {
  try {
    const projectId = req.query.projectId || req.headers['x-project-id'] || 'default';
    const data = await problemsService.getProblems(req.userId, projectId);
    res.json({ data: { ...data, summary: problemsService.summarize(data) } });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// DELETE /editor/problems
router.delete('/problems', async (req, res) => {
  try {
    const projectId = req.query.projectId || req.headers['x-project-id'] || 'default';
    const data = await problemsService.clearProblems(req.userId, projectId);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// ── Debugger sessions (live DAP adapters: python / node) ─────────────────

router.get('/debug/sessions', async (req, res) => {
  try {
    const data = await debugService.listUserSessions(req.userId);
    res.json({ data: { sessions: data } });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

router.post('/debug/sessions', async (req, res) => {
  try {
    const data = await debugService.createSession(req.userId, req.body || {});
    res.status(201).json({ data });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

router.get('/debug/sessions/:id', async (req, res) => {
  try {
    const session = await debugService.getSession(req.params.id);
    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: { code: 'DEBUG_NOT_FOUND', message: 'Session not found', details: null } });
    }
    res.json({ data: session });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

router.post('/debug/sessions/:id/breakpoints', async (req, res) => {
  try {
    const session = await debugService.getSession(req.params.id);
    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: { code: 'DEBUG_NOT_FOUND', message: 'Session not found', details: null } });
    }
    const data = await debugService.setBreakpoints(req.params.id, req.body?.breakpoints || []);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// POST /editor/debug/sessions/:id/command — DAP-oriented control (continue/next/pause/stop/…)
router.post('/debug/sessions/:id/command', async (req, res) => {
  try {
    const session = await debugService.getSession(req.params.id);
    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: { code: 'DEBUG_NOT_FOUND', message: 'Session not found', details: null } });
    }
    const command = req.body?.command;
    if (!command) {
      return res.status(400).json({
        error: { code: 'DEBUG_MISSING_COMMAND', message: 'command is required', details: { allowed: debugService.COMMANDS } },
      });
    }
    const data = await debugService.applyCommand(req.params.id, command, req.body || {});
    res.json({ data });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message, details: null },
    });
  }
});

router.patch('/debug/sessions/:id', async (req, res) => {
  try {
    const session = await debugService.getSession(req.params.id);
    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: { code: 'DEBUG_NOT_FOUND', message: 'Session not found', details: null } });
    }
    const allowed = ['status', 'program', 'cwd', 'args', 'env', 'type', 'request', 'stackFrames', 'variables'];
    const patch = {};
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) patch[k] = req.body[k];
    }
    const data = await debugService.updateSession(req.params.id, patch);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

router.delete('/debug/sessions/:id', async (req, res) => {
  try {
    await debugService.destroySession(req.userId, req.params.id);
    res.json({ data: { deleted: true } });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message, details: null },
    });
  }
});

// GET /editor/debug/sessions/:id/stack — live stack frames from adapter
router.get('/debug/sessions/:id/stack', async (req, res) => {
  try {
    const session = await debugService.getSession(req.params.id);
    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: { code: 'DEBUG_NOT_FOUND', message: 'Session not found', details: null } });
    }
    const dapManager = require('../services/dap/manager');
    const stackFrames = dapManager.isLive(req.params.id)
      ? await dapManager.stackTrace(req.params.id)
      : (session.stackFrames || []);
    res.json({ data: { stackFrames } });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// GET /editor/debug/sessions/:id/variables
router.get('/debug/sessions/:id/variables', async (req, res) => {
  try {
    const session = await debugService.getSession(req.params.id);
    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: { code: 'DEBUG_NOT_FOUND', message: 'Session not found', details: null } });
    }
    const dapManager = require('../services/dap/manager');
    const variables = dapManager.isLive(req.params.id)
      ? await dapManager.variables(req.params.id, Number(req.query.variablesReference) || 1)
      : (session.variables || []);
    res.json({ data: { variables } });
  } catch (err) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

module.exports = router;
