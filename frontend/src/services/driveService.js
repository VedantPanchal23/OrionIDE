import api from './api';
import { getTemplateFiles } from '../templates/projectTemplates';

export const listProjects = () => api.get('/drive/projects');

/**
 * Create a top-level project folder under OrionIDE/, optionally seeding a template.
 * @param {string} name
 * @param {{ template?: string }} [opts]
 */
export async function createProject(name, opts = {}) {
  const listed = await listProjects();
  const rootFolderId = listed.data?.data?.rootFolderId;
  if (!rootFolderId) throw new Error('Could not resolve OrionIDE root folder');
  const folderRes = await api.post('/drive/files', {
    parentFolderId: rootFolderId,
    name,
    type: 'folder',
  });
  const project = folderRes.data?.data;
  const templateId = opts.template && opts.template !== 'blank' ? opts.template : null;
  if (!project?.id || !templateId) return folderRes;

  const files = getTemplateFiles(templateId, name);
  const folderCache = { '': project.id };

  const ensureFolder = async (relDir) => {
    if (folderCache[relDir]) return folderCache[relDir];
    const parts = relDir.split('/').filter(Boolean);
    let parentId = project.id;
    let built = '';
    for (const part of parts) {
      built = built ? `${built}/${part}` : part;
      if (folderCache[built]) {
        parentId = folderCache[built];
        continue;
      }
      const created = await api.post('/drive/files', {
        parentFolderId: parentId,
        name: part,
        type: 'folder',
      });
      parentId = created.data?.data?.id;
      if (!parentId) throw new Error(`Failed to create folder ${built}`);
      folderCache[built] = parentId;
    }
    return parentId;
  };

  for (const file of files) {
    const norm = String(file.path || '').replace(/\\/g, '/');
    const slash = norm.lastIndexOf('/');
    const dir = slash >= 0 ? norm.slice(0, slash) : '';
    const base = slash >= 0 ? norm.slice(slash + 1) : norm;
    const parentId = dir ? await ensureFolder(dir) : project.id;
    await api.post('/drive/files', {
      parentFolderId: parentId,
      name: base,
      type: 'file',
      content: file.content ?? '',
    });
  }

  return folderRes;
}

export const listFiles = (folderId) =>
  api.get('/drive/files', { params: { folderId } });

export const createFile = (parentFolderId, name, type = 'file', content = '') =>
  api.post('/drive/files', { parentFolderId, name, type, content });

export const readFile = (fileId) =>
  api.get(`/drive/files/${fileId}`);

export const updateFile = (fileId, content) =>
  api.put(`/drive/files/${fileId}`, { content });

export const flushFile = (fileId, content) =>
  api.put(`/drive/files/${fileId}/flush`, { content });

export const deleteFile = (fileId) =>
  api.delete(`/drive/files/${fileId}`);

export const renameFile = (fileId, newName) =>
  api.patch(`/drive/files/${fileId}/rename`, { newName });

export const searchProject = (folderId, q) =>
  api.get('/drive/search', { params: { folderId, q } });
