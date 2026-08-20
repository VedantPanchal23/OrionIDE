/**
 * Local file history — IndexedDB ring buffer of saved snapshots.
 */

const DB_NAME = 'orion_local_history';
const STORE = 'snapshots';
const DB_VERSION = 1;
const MAX_PER_FILE = 30;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('byFile', 'fileId', { unique: false });
        store.createIndex('byFileAt', ['fileId', 'at'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  });
}

/**
 * @param {{ fileId: string, name?: string, content: string, projectId?: string }} snap
 */
export async function pushSnapshot({ fileId, name = '', content = '', projectId = '' }) {
  if (!fileId || typeof content !== 'string') return;
  // Skip empty / huge
  if (content.length > 1_500_000) return;

  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const index = store.index('byFile');

  const existing = await new Promise((resolve, reject) => {
    const req = index.getAll(IDBKeyRange.only(fileId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  // Dedupe identical consecutive content
  const sorted = existing.sort((a, b) => (b.at || 0) - (a.at || 0));
  if (sorted[0]?.content === content) {
    await txDone(tx);
    db.close();
    return;
  }

  store.add({
    fileId,
    name,
    projectId: projectId || '',
    content,
    at: Date.now(),
  });

  // Trim oldest beyond MAX_PER_FILE
  if (sorted.length >= MAX_PER_FILE) {
    const toDelete = sorted.slice(MAX_PER_FILE - 1);
    toDelete.forEach((row) => {
      if (row.id != null) store.delete(row.id);
    });
  }

  await txDone(tx);
  db.close();
}

export async function listSnapshots(fileId, limit = MAX_PER_FILE) {
  if (!fileId) return [];
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const index = tx.objectStore(STORE).index('byFile');
  const rows = await new Promise((resolve, reject) => {
    const req = index.getAll(IDBKeyRange.only(fileId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, limit)
    .map(({ id, fileId: fid, name, content, at, projectId }) => ({
      id, fileId: fid, name, content, at, projectId,
    }));
}

export async function getSnapshot(id) {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const row = await new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row;
}

export async function clearFileHistory(fileId) {
  if (!fileId) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.objectStore(STORE).index('byFile');
  const rows = await new Promise((resolve, reject) => {
    const req = index.getAll(IDBKeyRange.only(fileId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  rows.forEach((row) => {
    if (row.id != null) tx.objectStore(STORE).delete(row.id);
  });
  await txDone(tx);
  db.close();
}
