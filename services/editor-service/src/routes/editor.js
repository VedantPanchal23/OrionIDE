/**
 * Orion IDE — Editor Service Routes
 */

const express = require('express');
const { openFile, closeFile, getSession, setActiveFile, markDirty } = require('../services/sessionService');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('editor-service');
const router = express.Router();

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

module.exports = router;
