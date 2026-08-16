import api, { getAccessToken } from './api';

export async function startPipeline(goal, llm, { projectFolderId, projectName } = {}) {
  const body = { goal };
  if (llm?.apiKey) {
    body.llm = {
      provider: llm.provider,
      model: llm.model,
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl || undefined,
    };
  }
  if (projectFolderId) body.projectFolderId = projectFolderId;
  if (projectName) body.projectName = projectName;
  const res = await api.post('/agents/pipeline/start', body);
  return res.data?.data;
}

export async function getPipeline(sessionId) {
  const res = await api.get(`/agents/pipeline/${sessionId}`);
  return res.data?.data;
}

export async function approveStep(sessionId, step) {
  const res = await api.post(`/agents/pipeline/${sessionId}/approve`, { step });
  return res.data?.data;
}

export async function rejectStep(sessionId, step, reason) {
  const res = await api.post(`/agents/pipeline/${sessionId}/reject`, { step, reason });
  return res.data?.data;
}

export async function cancelPipeline(sessionId) {
  const res = await api.post(`/agents/pipeline/${sessionId}/cancel`);
  return res.data?.data;
}

export async function probeLlm({ provider, apiKey, model, baseUrl }) {
  const res = await api.post('/agents/llm/probe', {
    provider,
    apiKey,
    model: model || undefined,
    baseUrl: baseUrl || undefined,
  });
  return res.data?.data;
}

export function streamPipeline(sessionId, { onEvent, onError, onDone } = {}) {
  const token = getAccessToken() || '';
  const url = `/api/agents/pipeline/${sessionId}/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  const handle = (type) => (e) => {
    try {
      const data = e.data ? JSON.parse(e.data) : {};
      onEvent?.({ type, ...data });
    } catch {
      onEvent?.({ type, raw: e.data });
    }
  };

  [
    'PIPELINE_STARTED', 'AGENT_THINKING', 'AGENT_COMPLETE', 'WAITING_APPROVAL',
    'STEP_APPROVED', 'STEP_REJECTED', 'AGENT_ERROR', 'MAX_REJECTIONS',
    'REVIEW_RETRY', 'REVIEW_COMPLETE', 'PROJECT_FOLDER_READY', 'PIPELINE_COMPLETE',
    'PIPELINE_CANCELLED', 'PIPELINE_FAILED',
    'FILE_PROGRESS', 'FILE_WRITTEN', 'FILE_WRITE_SKIPPED', 'ALL_FILES_COMPLETE',
    'IMPLEMENTATION_STARTED',
  ].forEach((type) => es.addEventListener(type, handle(type)));

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent?.(data);
    } catch {
      onEvent?.({ type: 'message', raw: e.data });
    }
  };

  es.onerror = () => {
    onError?.(new Error('stream_closed'));
    es.close();
    onDone?.();
  };

  return () => {
    es.close();
    onDone?.();
  };
}

export async function startChat(message, llm, {
  projectFolderId, projectName, history, applyFiles = true, codeContext,
} = {}) {
  const body = { message, applyFiles };
  if (Array.isArray(history)) body.history = history;
  if (codeContext) body.codeContext = String(codeContext).slice(0, 4000);
  if (llm?.apiKey) {
    body.llm = {
      provider: llm.provider,
      model: llm.model,
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl || undefined,
    };
  }
  if (projectFolderId) body.projectFolderId = projectFolderId;
  if (projectName) body.projectName = projectName;
  const res = await api.post('/agents/chat', body);
  return res.data?.data;
}

export async function generateCommitMessage({ summary, diff, llm } = {}) {
  const body = { summary, diff };
  if (llm?.apiKey) {
    body.llm = {
      provider: llm.provider,
      model: llm.model,
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl || undefined,
    };
  }
  const res = await api.post('/agents/commit-message', body);
  return res.data?.data;
}

export async function inlineEdit({
  instruction, code, language, filePath, surrounding, llm, projectFolderId,
} = {}) {
  const body = {
    instruction,
    code,
    language: language || undefined,
    filePath: filePath || undefined,
    surrounding: surrounding || undefined,
  };
  if (llm?.apiKey) {
    body.llm = {
      provider: llm.provider,
      model: llm.model,
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl || undefined,
    };
  }
  if (projectFolderId) body.projectFolderId = projectFolderId;
  const res = await api.post('/agents/inline-edit', body);
  return res.data?.data;
}

export function streamChat(sessionId, { onEvent, onError, onDone } = {}) {
  const token = getAccessToken() || '';
  const url = `/api/agents/chat/${sessionId}/stream?token=${encodeURIComponent(token)}`;
  const es = new EventSource(url);

  const handle = (type) => (e) => {
    try {
      const data = e.data ? JSON.parse(e.data) : {};
      onEvent?.({ type, ...data });
    } catch {
      onEvent?.({ type, raw: e.data });
    }
  };

  [
    'CHAT_STARTED', 'CHAT_THINKING', 'CHAT_COMPLETE', 'CHAT_ERROR', 'CHAT_DONE', 'CHAT_INFO',
    'FILE_WRITTEN',
  ].forEach((type) => es.addEventListener(type, handle(type)));

  es.onmessage = (e) => {
    try {
      onEvent?.(JSON.parse(e.data));
    } catch {
      onEvent?.({ type: 'message', raw: e.data });
    }
  };

  es.onerror = () => {
    onError?.(new Error('stream_closed'));
    es.close();
    onDone?.();
  };

  return () => {
    es.close();
    onDone?.();
  };
}
