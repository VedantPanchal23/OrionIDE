/**
 * Sync IDE prefs to Drive at `.orion/settings.json` (API key never synced).
 */
import * as driveService from '../services/driveService';
import { exportSettings, importSettings } from './settingsBackup';

const ORION_DIR = '.orion';
const SETTINGS_FILE = 'settings.json';

async function findChild(parentId, name, isFolder) {
  const res = await driveService.listFiles(parentId);
  const files = res.data?.data?.files || [];
  return files.find((f) => {
    const folder = Boolean(f.isFolder || f.mimeType === 'application/vnd.google-apps.folder' || f.type === 'folder');
    return f.name === name && folder === Boolean(isFolder);
  }) || null;
}

async function ensureOrionFolder(projectId) {
  let folder = await findChild(projectId, ORION_DIR, true);
  if (!folder) {
    const created = await driveService.createFile(projectId, ORION_DIR, 'folder');
    folder = created.data?.data;
  }
  if (!folder?.id) throw new Error('Could not create .orion folder');
  return folder.id;
}

async function findSettingsFile(projectId) {
  const folder = await findChild(projectId, ORION_DIR, true);
  if (!folder?.id) return { folderId: null, file: null };
  const file = await findChild(folder.id, SETTINGS_FILE, false);
  return { folderId: folder.id, file };
}

/**
 * Push local settings (no API key) to Drive `.orion/settings.json`.
 */
export async function pushSettingsToDrive(projectId) {
  if (!projectId) throw new Error('No project open');
  const payload = exportSettings({ includeApiKey: false });
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  const { folderId, file } = await findSettingsFile(projectId);
  const parentId = folderId || await ensureOrionFolder(projectId);
  if (file?.id) {
    await driveService.updateFile(file.id, body);
    return { fileId: file.id, created: false };
  }
  const created = await driveService.createFile(parentId, SETTINGS_FILE, 'file', body);
  return { fileId: created.data?.data?.id, created: true };
}

/**
 * Pull `.orion/settings.json` from Drive into localStorage.
 * Returns false if file missing.
 */
export async function pullSettingsFromDrive(projectId) {
  if (!projectId) throw new Error('No project open');
  const { file } = await findSettingsFile(projectId);
  if (!file?.id) return { applied: false, missing: true };
  const res = await driveService.readFile(file.id);
  const content = res.data?.data?.content ?? res.data?.content ?? '';
  const payload = typeof content === 'string' ? JSON.parse(content) : content;
  importSettings(payload);
  return { applied: true, missing: false, fileId: file.id };
}
