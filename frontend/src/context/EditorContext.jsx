/**
 * Orion IDE — Editor session context
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import * as driveService from '../services/driveService';
import { getMonacoLanguage } from '../utils/languageMap';
import { rememberIndexedFile } from '../lib/projectIndexCache';
import * as termSession from '../lib/terminalSession';
import * as localHistory from '../lib/localHistory';

const EditorContext = createContext(null);
/** Debounce keystrokes before flushing to Drive — keep > typical typing pause. */
const AUTOSAVE_DELAY = 1200;
/** After an intentional save, refresh the terminal workspace (Drive → disk). */
const WORKSPACE_PULL_DELAY = 2800;

export function EditorProvider({ children }) {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [secondaryFileId, setSecondaryFileId] = useState(null);
  const [split, setSplit] = useState(false);
  const [focusedPane, setFocusedPane] = useState('primary');
  const [saveStatus, setSaveStatus] = useState({});
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [revealRequest, setRevealRequest] = useState(null);
  const [pauseLine, setPauseLine] = useState(null); // { fileId, line }

  const openFilesRef = useRef(openFiles);
  const activeFileIdRef = useRef(activeFileId);
  const secondaryFileIdRef = useRef(secondaryFileId);
  const splitRef = useRef(split);
  const focusedPaneRef = useRef(focusedPane);
  const autosaveTimers = useRef(new Map());
  const liveContentGetters = useRef(new Map());
  /** Per-file save generation — ignore stale flush completions. */
  const saveGenRef = useRef(new Map());
  const workspacePullTimer = useRef(null);
  const scheduleAutosaveRef = useRef(null);

  // Keep refs in sync during render so getLiveContent never lags one commit.
  openFilesRef.current = openFiles;
  activeFileIdRef.current = activeFileId;
  secondaryFileIdRef.current = secondaryFileId;
  splitRef.current = split;
  focusedPaneRef.current = focusedPane;

  useEffect(() => () => {
    autosaveTimers.current.forEach((t) => clearTimeout(t));
    if (workspacePullTimer.current) clearTimeout(workspacePullTimer.current);
  }, []);

  const getLiveContent = useCallback((id) => {
    const getter = liveContentGetters.current.get(id);
    if (typeof getter === 'function') {
      try {
        const live = getter();
        if (typeof live === 'string') return live;
      } catch { /* ignore */ }
    }
    return openFilesRef.current.find((f) => f.id === id)?.content ?? '';
  }, []);

  const registerLiveContent = useCallback((id, getter) => {
    if (getter) liveContentGetters.current.set(id, getter);
    else liveContentGetters.current.delete(id);
    return () => { liveContentGetters.current.delete(id); };
  }, []);

  const requestReveal = useCallback((fileId, line, column = 1) => {
    if (!fileId || !line) return;
    setRevealRequest({ fileId, line, column, nonce: Date.now() });
  }, []);

  const openFile = useCallback(async (fileMeta, opts = {}) => {
    const existing = openFilesRef.current.find((f) => f.id === fileMeta.id);
    const targetSplit = Boolean(opts.split || opts.pane === 'secondary');

    const assignOpen = () => {
      if (targetSplit) {
        setSplit(true);
        setSecondaryFileId(fileMeta.id);
        setFocusedPane('secondary');
      } else if (focusedPaneRef.current === 'secondary' && splitRef.current) {
        setSecondaryFileId(fileMeta.id);
      } else {
        setActiveFileId(fileMeta.id);
        setFocusedPane('primary');
      }
      if (opts.line) requestReveal(fileMeta.id, opts.line, opts.column || 1);
    };

    if (existing) {
      assignOpen();
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
    assignOpen();

    try {
      const seed = typeof fileMeta.initialContent === 'string' ? fileMeta.initialContent : null;
      const res = seed == null ? await driveService.readFile(fileMeta.id) : null;
      const text = seed != null
        ? seed
        : (typeof res.data?.data?.content === 'string' ? res.data.data.content : '');
      setOpenFiles((prev) => prev.map((f) => {
        if (f.id !== fileMeta.id) return f;
        // Never clobber edits if the buffer became dirty while loading.
        if (f.isDirty) return { ...f, loading: false };
        return { ...f, content: text, originalContent: text, loading: false };
      }));
      rememberIndexedFile({ id: fileMeta.id, name: fileMeta.name, content: text });
      if (opts.line) requestReveal(fileMeta.id, opts.line, opts.column || 1);
      return { ...placeholder, content: text, loading: false };
    } catch (err) {
      setOpenFiles((prev) => prev.filter((f) => f.id !== fileMeta.id));
      if (activeFileIdRef.current === fileMeta.id) setActiveFileId(null);
      if (secondaryFileIdRef.current === fileMeta.id) setSecondaryFileId(null);
      throw err;
    }
  }, [requestReveal]);

  const closeFile = useCallback((id, { force = false } = {}) => {
    const file = openFilesRef.current.find((f) => f.id === id);
    if (file?.isDirty && !force) {
      return { needsConfirm: true, file };
    }
    setOpenFiles((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((f) => f.id !== id);
      if (activeFileIdRef.current === id) {
        const neighbor = next[idx] || next[idx - 1] || null;
        setActiveFileId(neighbor ? neighbor.id : null);
      }
      return next;
    });
    setSecondaryFileId((cur) => (cur === id ? null : cur));
    const timer = autosaveTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      autosaveTimers.current.delete(id);
    }
    return { closed: true };
  }, []);

  const closeAll = useCallback(({ force = false } = {}) => {
    const dirty = openFilesRef.current.filter((f) => f.isDirty);
    if (dirty.length && !force) {
      return { needsConfirm: true, files: dirty };
    }
    openFilesRef.current.forEach((f) => {
      const timer = autosaveTimers.current.get(f.id);
      if (timer) {
        clearTimeout(timer);
        autosaveTimers.current.delete(f.id);
      }
    });
    setOpenFiles([]);
    setActiveFileId(null);
    setSecondaryFileId(null);
    setSplit(false);
    return { closed: true };
  }, []);

  const hasDirty = openFiles.some((f) => f.isDirty);

  useEffect(() => {
    if (!hasDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasDirty]);

  const bumpSaveGen = useCallback((id) => {
    const next = (saveGenRef.current.get(id) || 0) + 1;
    saveGenRef.current.set(id, next);
    return next;
  }, []);

  /** Debounced Drive→disk sync for the terminal only — never on every autosave. */
  const scheduleWorkspacePull = useCallback(() => {
    if (workspacePullTimer.current) clearTimeout(workspacePullTimer.current);
    workspacePullTimer.current = setTimeout(() => {
      workspacePullTimer.current = null;
      termSession.syncWithDrive('pull').catch(() => {});
    }, WORKSPACE_PULL_DELAY);
  }, []);

  /**
   * Apply a successful flush without rewriting the live Monaco buffer.
   * Rewriting `content` from a pre-await snapshot caused cursor jumps / fake undo.
   */
  const applySaveSuccess = useCallback((id, savedContent, gen) => {
    if (saveGenRef.current.get(id) !== gen) return { applied: false, live: getLiveContent(id) };
    const live = getLiveContent(id);
    const stillDirty = live !== savedContent;
    const open = openFilesRef.current.find((f) => f.id === id);
    setOpenFiles((prev) => prev.map((f) => (
      f.id === id
        ? { ...f, originalContent: savedContent, isDirty: stillDirty }
        : f
    )));
    if (stillDirty) {
      setSaveStatus((prev) => ({ ...prev, [id]: 'dirty' }));
      scheduleAutosaveRef.current?.(id);
    } else {
      setSaveStatus((prev) => ({ ...prev, [id]: 'saved' }));
      setTimeout(() => {
        setSaveStatus((prev) => (prev[id] === 'saved' ? { ...prev, [id]: 'idle' } : prev));
      }, 1600);
    }
    // Local history snapshot (browser IndexedDB) — best-effort
    localHistory.pushSnapshot({
      fileId: id,
      name: open?.name || '',
      content: savedContent,
    }).catch(() => {});
    return { applied: true, live, stillDirty };
  }, [getLiveContent]);

  const scheduleAutosave = useCallback((id) => {
    const existing = autosaveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    setSaveStatus((prev) => ({ ...prev, [id]: 'dirty' }));
    const timer = setTimeout(async () => {
      autosaveTimers.current.delete(id);
      const content = getLiveContent(id);
      const open = openFilesRef.current.find((f) => f.id === id);
      if (open && content === open.originalContent) {
        setSaveStatus((prev) => ({ ...prev, [id]: 'idle' }));
        return;
      }
      const gen = bumpSaveGen(id);
      setSaveStatus((prev) => ({ ...prev, [id]: 'saving' }));
      try {
        await driveService.flushFile(id, content);
        applySaveSuccess(id, content, gen);
        // Do NOT pull the whole project on autosave — that races auto-push and
        // can overwrite newer Drive content while the user is still typing.
      } catch {
        if (saveGenRef.current.get(id) === gen) {
          setSaveStatus((prev) => ({ ...prev, [id]: 'error' }));
        }
      }
    }, AUTOSAVE_DELAY);
    autosaveTimers.current.set(id, timer);
  }, [getLiveContent, bumpSaveGen, applySaveSuccess]);

  scheduleAutosaveRef.current = scheduleAutosave;

  const updateContent = useCallback((id, newContent) => {
    setOpenFiles((prev) => prev.map((f) => (
      f.id === id ? { ...f, content: newContent, isDirty: newContent !== f.originalContent } : f
    )));
    scheduleAutosave(id);
  }, [scheduleAutosave]);

  const saveFile = useCallback(async (id) => {
    const pending = autosaveTimers.current.get(id);
    if (pending) {
      clearTimeout(pending);
      autosaveTimers.current.delete(id);
    }
    const content = getLiveContent(id);
    const gen = bumpSaveGen(id);
    setSaveStatus((prev) => ({ ...prev, [id]: 'saving' }));
    try {
      await driveService.flushFile(id, content);
      const result = applySaveSuccess(id, content, gen);
      // Intentional save: refresh terminal disk after a quiet window (not immediately).
      if (result.applied && !result.stillDirty) scheduleWorkspacePull();
      return result.live;
    } catch (err) {
      if (saveGenRef.current.get(id) === gen) {
        setSaveStatus((prev) => ({ ...prev, [id]: 'error' }));
      }
      throw err;
    }
  }, [getLiveContent, bumpSaveGen, applySaveSuccess, scheduleWorkspacePull]);

  const toggleSplit = useCallback(() => {
    setSplit((on) => {
      if (on) {
        setSecondaryFileId(null);
        setFocusedPane('primary');
        return false;
      }
      setSecondaryFileId((cur) => cur || activeFileIdRef.current);
      return true;
    });
  }, []);

  const openToSide = useCallback(async (fileMeta) => {
    await openFile(fileMeta, { split: true });
  }, [openFile]);

  const switchTab = useCallback((id) => {
    if (focusedPaneRef.current === 'secondary' && splitRef.current) {
      setSecondaryFileId(id);
    } else {
      setActiveFileId(id);
    }
  }, []);

  const renameOpenFile = useCallback((id, newName) => {
    const trimmed = String(newName || '').trim();
    if (!id || !trimmed) return;
    setOpenFiles((prev) => prev.map((f) => (
      f.id === id
        ? { ...f, name: trimmed, language: getMonacoLanguage(trimmed) }
        : f
    )));
  }, []);

  const closeDescendants = useCallback((rootId, { force = false } = {}) => {
    const ids = openFilesRef.current
      .filter((f) => f.id === rootId || f.parentId === rootId)
      .map((f) => f.id);
    const dirty = openFilesRef.current.filter((f) => ids.includes(f.id) && f.isDirty);
    if (dirty.length && !force) {
      return { needsConfirm: true, files: dirty, ids };
    }
    ids.forEach((id) => closeFile(id, { force: true }));
    return { closed: true, ids };
  }, [closeFile]);

  const activeFile = openFiles.find((f) => f.id === activeFileId) || null;
  const secondaryFile = openFiles.find((f) => f.id === secondaryFileId) || null;
  const focusedFile = focusedPane === 'secondary' && secondaryFile ? secondaryFile : activeFile;

  const value = useMemo(() => ({
    openFiles,
    activeFile,
    activeFileId,
    secondaryFile,
    secondaryFileId,
    focusedFile,
    focusedPane,
    setFocusedPane,
    split,
    toggleSplit,
    openToSide,
    setSecondaryFileId,
    saveStatus,
    cursorPosition,
    setCursorPosition,
    revealRequest,
    clearReveal: () => setRevealRequest(null),
    requestReveal,
    pauseLine,
    setPauseLine,
    openFile,
    closeFile,
    closeAll,
    closeDescendants,
    hasDirty,
    switchTab,
    renameOpenFile,
    updateContent,
    saveFile,
    getLiveContent,
    registerLiveContent,
  }), [
    openFiles, activeFile, activeFileId, secondaryFile, secondaryFileId, focusedFile,
    focusedPane, split, toggleSplit, openToSide, saveStatus, cursorPosition, revealRequest,
    requestReveal, pauseLine, openFile, closeFile, closeAll, closeDescendants, hasDirty,
    switchTab, renameOpenFile, updateContent, saveFile, getLiveContent, registerLiveContent,
  ]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
