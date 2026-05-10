/**
 * Orion IDE — Execution Routes
 *
 * POST /execute — submit code for execution
 * GET  /execute/:id/stream — SSE stream
 * GET  /execute/:id/result — polling fallback
 * GET  /execute/languages — 18 languages with availability status
 */

const express = require('express');
const { createExecution, streamResult, getResult, checkRateLimit } = require('../services/streamService');
const { getLanguagesWithStatus, resolveLanguage } = require('../services/pistonService');
const { getById } = require('../services/languageMap');
const { createLogger } = require('../../../../shared/utils/logger');

const logger = createLogger('execution-service');
const router = express.Router();

router.use((req, res, next) => {
  req.userId = req.headers['x-user-id'] || 'anonymous';
  next();
});

// POST /execute — submit code
router.post('/', async (req, res) => {
  try {
    const { language, languageId, fileName, code, stdin } = req.body;
    const langKey = languageId || language;

    if (!langKey || !code) {
      return res.status(400).json({
        error: { code: 'EXEC_MISSING_PARAM', message: 'language/languageId and code are required', details: null },
      });
    }

    // Validate language is in registry
    const resolved = getById(langKey) || (resolveLanguage(langKey) ? getById(resolveLanguage(langKey)?.id || langKey) : null);
    if (!resolved && !resolveLanguage(langKey)) {
      return res.status(422).json({
        error: { code: 'LANGUAGE_NOT_AVAILABLE', message: `Language '${langKey}' is not supported. Supported: 18 languages.`, details: null },
      });
    }

    // Rate limit
    const rateCheck = await checkRateLimit(req.userId);
    if (!rateCheck.allowed) {
      res.setHeader('X-RateLimit-Limit', rateCheck.limit);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error: { code: 'EXEC_RATE_LIMIT', message: 'Too many executions. Max 10 per minute.', details: null },
      });
    }
    res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);

    const { executionId } = await createExecution(req.userId, langKey, fileName || 'main', code, stdin);

    res.status(201).json({
      data: { executionId },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    if (err.code === 'EXEC_UNSUPPORTED_LANG') {
      return res.status(422).json({
        error: { code: 'LANGUAGE_NOT_AVAILABLE', message: err.message, details: null },
      });
    }
    logger.error('Execute failed', { error: err.message });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message, details: null },
    });
  }
});

// GET /execute/languages — 18 languages with availability
router.get('/languages', async (req, res) => {
  try {
    const languages = await getLanguagesWithStatus();
    res.json({
      data: languages,
      meta: { count: languages.length, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    logger.error('Get languages failed', { error: err.message });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message, details: null },
    });
  }
});

// GET /execute/:executionId/stream — SSE
router.get('/:executionId/stream', (req, res) => {
  streamResult(res, req.params.executionId);
});

// GET /execute/:executionId/result — polling
router.get('/:executionId/result', async (req, res) => {
  try {
    const result = await getResult(req.params.executionId);
    if (!result) {
      return res.status(404).json({
        error: { code: 'EXEC_NOT_FOUND', message: 'Execution not found', details: null },
      });
    }
    res.json({ data: result });
  } catch (err) {
    logger.error('Get result failed', { error: err.message });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message, details: null },
    });
  }
});

module.exports = router;
