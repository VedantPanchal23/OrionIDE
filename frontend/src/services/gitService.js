/**
 * Git API client — /api/git → terminal-service
 */

import api from './api';

export async function gitStatus(projectId) {
  const res = await api.get('/git/status', { params: { projectId } });
  return res.data?.data || res.data;
}

export async function gitCommit(projectId, message, files = []) {
  const res = await api.post('/git/commit', { projectId, message, files });
  return res.data?.data || res.data;
}

export async function gitStage(projectId, files = []) {
  const res = await api.post('/git/stage', { projectId, files });
  return res.data?.data || res.data;
}

export async function gitUnstage(projectId, files = []) {
  const res = await api.post('/git/unstage', { projectId, files });
  return res.data?.data || res.data;
}

export async function gitInit(projectId) {
  const res = await api.post('/git/init', { projectId });
  return res.data?.data || res.data;
}

export const gitService = {
  status: gitStatus,
  commit: gitCommit,
  stage: gitStage,
  unstage: gitUnstage,
  init: gitInit,
};
