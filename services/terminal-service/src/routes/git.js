/**
 * Orion IDE — Git HTTP routes (served by terminal-service)
 *
 * GET  /git/status?projectId=
 * POST /git/commit  { projectId, message, files? }
 * POST /git/stage   { projectId, files? }
 * POST /git/unstage { projectId, files? }
 */

const express = require('express');
const gitService = require('../services/gitService');

const router = express.Router();

const requireUser = (req, res) => {
  if (!req.userId) {
    res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Missing X-User-Id header' } });
    return false;
  }
  return true;
};

const resolveProjectId = (req) =>
  req.query.projectId ||
  req.query.projectFolderId ||
  req.headers['x-project-id'] ||
  req.body?.projectId ||
  req.body?.projectFolderId ||
  null;

router.get('/status', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({
      error: {
        code: 'GIT_MISSING_PROJECT',
        message: 'projectId query param or X-Project-Id header is required',
      },
    });
  }
  try {
    const data = await gitService.getStatus(req.userId, projectId);
    res.json({ data });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || 'GIT_ERROR', message: err.message },
    });
  }
});

router.post('/commit', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({
      error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' },
    });
  }
  try {
    const data = await gitService.commit(req.userId, projectId, {
      message: req.body?.message,
      files: Array.isArray(req.body?.files) ? req.body.files : [],
    });
    res.json({ data });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || 'GIT_ERROR', message: err.message },
    });
  }
});

router.post('/stage', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({
      error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' },
    });
  }
  try {
    const data = await gitService.stage(
      req.userId,
      projectId,
      Array.isArray(req.body?.files) ? req.body.files : []
    );
    res.json({ data });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || 'GIT_ERROR', message: err.message },
    });
  }
});

router.post('/unstage', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({
      error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' },
    });
  }
  try {
    const data = await gitService.unstage(
      req.userId,
      projectId,
      Array.isArray(req.body?.files) ? req.body.files : []
    );
    res.json({ data });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || 'GIT_ERROR', message: err.message },
    });
  }
});

router.get('/log', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({
      error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' },
    });
  }
  try {
    const data = await gitService.getLog(req.userId, projectId, req.query.limit);
    res.json({ data });
  } catch (err) {
    res.status(err.status || 500).json({
      error: { code: err.code || 'GIT_ERROR', message: err.message },
    });
  }
});

router.get('/remotes', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.listRemotes(req.userId, projectId) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.put('/remotes', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.setRemote(req.userId, projectId, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.post('/pull', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.pull(req.userId, projectId, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.post('/push', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.push(req.userId, projectId, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.post('/clone', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.status(201).json({ data: await gitService.cloneRemote(req.userId, projectId, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.get('/branches', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.listBranches(req.userId, projectId) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.post('/checkout', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.checkoutBranch(req.userId, projectId, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.get('/diff', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  const filePath = req.query.path;
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.getFileDiff(req.userId, projectId, filePath) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.get('/conflicts', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.listConflicts(req.userId, projectId) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.post('/conflicts/resolve', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.resolveConflict(req.userId, projectId, req.body || {}) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.post('/merge/abort', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.abortMerge(req.userId, projectId) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GIT_ERROR', message: err.message } });
  }
});

router.get('/pull-requests', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    res.json({ data: await gitService.listPullRequests(req.userId, projectId, { limit: req.query.limit }) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GH_ERROR', message: err.message } });
  }
});

router.post('/pull-requests/checkout', async (req, res) => {
  if (!requireUser(req, res)) return;
  const projectId = resolveProjectId(req);
  if (!projectId) {
    return res.status(400).json({ error: { code: 'GIT_MISSING_PROJECT', message: 'projectId is required' } });
  }
  try {
    const number = req.body?.number ?? req.body?.pr;
    res.json({ data: await gitService.checkoutPullRequest(req.userId, projectId, number) });
  } catch (err) {
    res.status(err.status || 500).json({ error: { code: err.code || 'GH_ERROR', message: err.message } });
  }
});

module.exports = router;
