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
  req.userId = req.headers['x-user-id'] || 'anonymous';
  next();
});

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

    const { sessionId, session } = await startPipeline(req.userId, goal.trim());
    res.status(201).json({ data: { sessionId, session }, meta: { timestamp: new Date().toISOString() } });
  } catch (err) {
    logger.error('Start pipeline failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// GET /agents/pipeline/:sessionId
router.get('/pipeline/:sessionId', async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: { code: 'PIPELINE_NOT_FOUND', message: 'Session not found', details: null } });
    }
    res.json({ data: session });
  } catch (err) {
    logger.error('Get session failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// POST /agents/pipeline/:sessionId/approve
router.post('/pipeline/:sessionId/approve', async (req, res) => {
  try {
    const { step } = req.body;
    if (!step) {
      return res.status(400).json({ error: { code: 'AGENT_MISSING_STEP', message: 'step is required', details: null } });
    }
    const session = await approveStep(req.params.sessionId, parseInt(step, 10));
    res.json({ data: session });
  } catch (err) {
    if (err.code === 'PIPELINE_NOT_FOUND') {
      return res.status(404).json({ error: { code: err.code, message: err.message, details: null } });
    }
    logger.error('Approve step failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// POST /agents/pipeline/:sessionId/reject
router.post('/pipeline/:sessionId/reject', async (req, res) => {
  try {
    const { step, reason } = req.body;
    if (!step || !reason) {
      return res.status(400).json({ error: { code: 'AGENT_MISSING_PARAM', message: 'step and reason are required', details: null } });
    }
    const session = await rejectStep(req.params.sessionId, parseInt(step, 10), reason);
    res.json({ data: session });
  } catch (err) {
    if (err.code === 'PIPELINE_NOT_FOUND') {
      return res.status(404).json({ error: { code: err.code, message: err.message, details: null } });
    }
    logger.error('Reject step failed', { error: err.message });
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message, details: null } });
  }
});

// GET /agents/pipeline/:sessionId/stream — SSE
router.get('/pipeline/:sessionId/stream', (req, res) => {
  streamSession(res, req.params.sessionId);
});

module.exports = router;
