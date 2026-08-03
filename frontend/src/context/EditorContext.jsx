/**
 * Orion IDE — Editor session context
 *
 * Project-scoped: the parent renders `<EditorProvider key={projectId}>`,
 * so switching projects remounts this provider and every tab, cursor
 * position and save state resets naturally — no cross-project leakage.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import * as driveService from '../services/driveService';
import { getMonacoLanguage } from '../utils/languageMap';

const EditorContext = createContext(null);

const AUTOSAVE_DELAY = 1100;

export function EditorProvider({ projectId, children }) {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [saveStatus, setSaveStatus] = useState({});
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [pendingReveal, setPendingReveal] = useState(null);

  const openFilesRef = useRef(openFiles);
  const activeFileIdRef = useRef(activeFileId);
  const autosaveTimers = useRef(new Map());
  const revealFns = useRef(new Map());

  useEffect(() => { openFilesRef.current = openFiles; }, [openFiles]);
  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);

  useEffect(() => () => {
    autosaveTimers.current.forEach((t) => clearTimeout(t));
  }, []);

  const openFile = useCallback(async (fileMeta) => {
    const existing = openFilesRef.current.find((f) => f.id === fileMeta.id);
    if (existing) {
      setActiveFileId(fileMeta.id);
      return existing;
    }

    const language = fileMeta.language || getMonacoLanguage(fileMeta.name);
    const placeholder = {
      id: fileMeta.id,
      name: fileMeta.name,
      parentId: fileMeta.parentId ?? null,
      language,
      content: '',
      originalContent: '',
      isDirty: false,
      loading: true,
    };
    setOpenFiles((prev) => [...prev, placeholder]);
    setActiveFileId(fileMeta.id);

    try {
      const res = await driveService.readFile(fileMeta.id);
      const payload = res.data?.data || {};
      const raw = payload.content;
      const text = typeof raw === 'string' ? raw : '';
      setOpenFiles((prev) => prev.map((f) => (
        f.id === fileMeta.id ? { ...f, content: text, originalContent: text, loading: false } : f
      )));
      return { ...placeholder, content: text, loading: false };
    } catch (err) {
      setOpenFiles((prev) => {
        const idx = prev.findIndex((f) => f.id === fileMeta.id);
        if (idx === -1) return prev;
        const next = prev.filter((f) => f.id !== fileMeta.id);
        if (activeFileIdRef.current === fileMeta.id) {
          const neighbor = next[idx] || next[idx - 1] || next[0] || null;
          setActiveFileId(neighbor ? neighbor.id : null);
        }
        return next;
      });
      const message = err?.response?.data?.error?.message || err.message || 'Failed to open file';
      const wrapped = new Error(message);
      wrapped.original = err;
      throw wrapped;
    }
  }, []);

  const closeFile = useCallback((id) => {
    setOpenFiles((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((f) => f.id !== id);
      if (activeFileIdRef.current === id) {
        const neighbor = next[idx] || next[idx - 1] || next[0] || null;
        setActiveFileId(neighbor ? neighbor.id : null);
      }
      return next;
    });
    revealFns.current.delete(id);
    const timer = autosaveTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      autosaveTimers.current.delete(id);
    }
    setSaveStatus((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const switchTab = useCallback((id) => {
    if (openFilesRef.current.some((f) => f.id === id)) setActiveFileId(id);
  }, []);

  const scheduleAutosave = useCallback((id, content) => {
    const existing = autosaveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      driveService.updateFile(id, content).catch(() => { /* buffered — best effort */ });
      autosaveTimers.current.delete(id);
    }, AUTOSAVE_DELAY);
    autosaveTimers.current.set(id, timer);
  }, []);

  const updateContent = useCallback((id, newContent) => {
    setOpenFiles((prev) => prev.map((f) => (
      f.id === id ? { ...f, content: newContent, isDirty: newContent !== f.originalContent } : f
    )));
    scheduleAutosave(id, newContent);
  }, [scheduleAutosave]);

  const saveFile = useCallback(async (id) => {
    const file = openFilesRef.current.find((f) => f.id === id);
    if (!file) return;
    setSaveStatus((prev) => ({ ...prev, [id]: 'saving' }));
    try {
      await driveService.flushFile(id, file.content);
      setOpenFiles((prev) => prev.map((f) => (
        f.id === id ? { ...f, originalContent: f.content, isDirty: false } : f
      )));
      setSaveStatus((prev) => ({ ...prev, [id]: 'saved' }));
      setTimeout(() => {
        setSaveStatus((prev) => (prev[id] === 'saved' ? { ...prev, [id]: 'idle' } : prev));
      }, 1800);
    } catch (err) {
      setSaveStatus((prev) => ({ ...prev, [id]: 'error' }));
      throw err;
    }
  }, []);

  const registerReveal = useCallback((id, fn) => {
    if (fn) revealFns.current.set(id, fn);
    else revealFns.current.delete(id);
  }, []);

  const revealLine = useCallback((fileOrId, line) => {
    const id = typeof fileOrId === 'string' ? fileOrId : fileOrId.id;
    const already = openFilesRef.current.find((f) => f.id === id);
    const activate = () => {
      setActiveFileId(id);
      const fn = revealFns.current.get(id);
      if (fn) {
        fn(line);
        setPendingReveal(null);
      } else {
        setPendingReveal({ fileId: id, line, nonce: Date.now() });
      }
    };
    if (already) {
      activate();
    } else if (typeof fileOrId === 'object' && fileOrId.name) {
      openFile(fileOrId).then(activate).catch(() => {});
    }
  }, [openFile]);

  const consumeReveal = useCallback((id) => {
    setPendingReveal((prev) => (prev && prev.fileId === id ? null : prev));
  }, []);

  const activeFile = useMemo(
    () => openFiles.find((f) => f.id === activeFileId) || null,
    [openFiles, activeFileId],
  );

  const value = useMemo(() => ({
    projectId,
    openFiles,
    activeFileId,
    activeFile,
    openFile,
    closeFile,
    switchTab,
    updateContent,
    saveFile,
    saveStatus,
    cursorPosition,
    setCursorPosition,
    registerReveal,
    revealLine,
    pendingReveal,
    consumeReveal,
  }), [
    projectId, openFiles, activeFileId, activeFile, openFile, closeFile, switchTab,
    updateContent, saveFile, saveStatus, cursorPosition, registerReveal, revealLine,
    pendingReveal, consumeReveal,
  ]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider
export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
