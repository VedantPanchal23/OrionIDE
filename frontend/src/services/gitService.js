import api from './api';

export const getStatus = (projectId) =>
  api.get('/git/status', { params: { projectId } });

export const getLog = (projectId, limit = 20) =>
  api.get('/git/log', { params: { projectId, limit } });

export const getBranches = (projectId) =>
  api.get('/git/branches', { params: { projectId } });

export const stage = (projectId, files) =>
  api.post('/git/stage', { projectId, files });

export const unstage = (projectId, files) =>
  api.post('/git/unstage', { projectId, files });

export const commit = (projectId, message, files) =>
  api.post('/git/commit', { projectId, message, files });

export const pull = (projectId) =>
  api.post('/git/pull', { projectId });

export const push = (projectId) =>
  api.post('/git/push', { projectId });

export const checkout = (projectId, branch, create = false) =>
  api.post('/git/checkout', { projectId, branch, create: Boolean(create) });

export const listRemotes = (projectId) =>
  api.get('/git/remotes', { params: { projectId } });

export const setRemote = (projectId, { name = 'origin', url }) =>
  api.put('/git/remotes', { projectId, name, url });

export const cloneRemote = (projectId, { url, branch }) =>
  api.post('/git/clone', { projectId, url, branch: branch || undefined });

export const getDiff = (projectId, filePath) =>
  api.get('/git/diff', { params: { projectId, path: filePath } });

export const listConflicts = (projectId) =>
  api.get('/git/conflicts', { params: { projectId } });

export const resolveConflict = (projectId, path, choice) =>
  api.post('/git/conflicts/resolve', { projectId, path, choice });

export const abortMerge = (projectId) =>
  api.post('/git/merge/abort', { projectId });

export const listPullRequests = (projectId, limit = 20) =>
  api.get('/git/pull-requests', { params: { projectId, limit } });

export const checkoutPullRequest = (projectId, number) =>
  api.post('/git/pull-requests/checkout', { projectId, number });

export const stageAll = async (projectId, paths) => {
  if (!paths?.length) return null;
  return stage(projectId, paths);
};
