/**
 * Orion IDE — Agent Routes
 */

const express = require('express');
const { startPipeline, approveStep, rejectStep, streamSession } = require('../services/pipelineService');
const { getSession } = require('../services/sessionService');
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
    const { goal } = req.body;
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

    const { sessionId, session } = await startPipeline(req.userId, goal.trim(), {
      googleAccessToken: req.googleAccessToken,
    });
    res.status(201).json({ data: { sessionId, session }, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    logger.error('Start pipeline failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// GET /agents/pipeline/:sessionId
router.get('/pipeline/:sessionId', async (req, res) => {
  try {
    const session = await assertSessionOwner(req.params.sessionId, req.userId);
    res.json({ data: session });
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

module.exports = router;
