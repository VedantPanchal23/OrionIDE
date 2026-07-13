/**
 * Orion IDE — Editor Context
 *
 * Provides: openFiles, activeFileId, openFile(), closeFile(), saveFile(),
 *           updateContent(), saveStatus
 *
 * Used by FileTree to open files, Editor to switch tabs, Topbar for Run.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { driveService } from '../services/driveService';
import { editorService } from '../services/editorService';
import { getLanguageFromFileName } from '../utils/languageMap';

const EditorContext = createContext(null);

export const useEditor = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
};

export const EditorProvider = ({ children }) => {
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Refs for latest state access (avoids stale closure issues)
  const openFilesRef = useRef(openFiles);
  const activeFileIdRef = useRef(activeFileId);
  const saveTimeoutRef = useRef(null);
  const writeBufferTimers = useRef(new Map()); // fileId → timer for debounced writes

  // Keep refs in sync
  useEffect(() => { openFilesRef.current = openFiles; }, [openFiles]);
  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);

  // ── Restore session on mount ────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await editorService.getSession();
        const session = res.data?.data;
        if (session && session.openFiles?.length > 0) {
          setOpenFiles(session.openFiles.map((f) => ({
            fileId: f.fileId,
            fileName: f.fileName,
            language: f.language || getLanguageFromFileName(f.fileName).monacoLanguage,
            content: null, // Will be loaded when tab is activated
            isDirty: false,
          })));
          setActiveFileId(session.activeFileId);
        }
      } catch {
        // No session to restore — that's OK
      }
    };
    restoreSession();
  }, []);

  // Track files currently being opened to prevent duplicate concurrent opens
  const openingFilesRef = useRef(new Set());

  // ── Open a file ────────────────────────────────────────────────────
  const openFile = useCallback(async (fileId, fileName) => {
    // Check if already open via ref (fast path)
    const existing = openFilesRef.current.find((f) => f.fileId === fileId);
    if (existing) {
      setActiveFileId(fileId);
      // If content was never loaded (restored session), load it now
      if (existing.content === null) {
        try {
          const res = await driveService.readFile(fileId);
          const content = res.data?.data?.content ?? '';
          setOpenFiles((prev) =>
            prev.map((f) => f.fileId === fileId ? { ...f, content } : f)
          );
        } catch {
          // Leave content as empty on error
          setOpenFiles((prev) =>
            prev.map((f) => f.fileId === fileId && f.content === null ? { ...f, content: '' } : f)
          );
        }
      }
      editorService.setActiveFile(fileId).catch(() => {});
      return;
    }

    // Prevent concurrent opens of the same file (race condition guard)
    if (openingFilesRef.current.has(fileId)) return;
    openingFilesRef.current.add(fileId);

    const langInfo = getLanguageFromFileName(fileName);

    // Load content from Drive
    let content = '';
    try {
      const res = await driveService.readFile(fileId);
      content = res.data?.data?.content ?? '';
    } catch {
      content = '';
    }

    const newFile = {
      fileId,
      fileName,
      language: langInfo.monacoLanguage,
      content,
      isDirty: false,
    };

    // Use functional setState to deduplicate (handles race between concurrent opens)
    setOpenFiles((prev) => {
      if (prev.some((f) => f.fileId === fileId)) return prev;
      return [...prev, newFile];
    });
    setActiveFileId(fileId);

    // Sync with backend session (fire and forget)
    editorService.openFile(fileId, fileName, langInfo.monacoLanguage).catch(() => {});

    openingFilesRef.current.delete(fileId);
  }, []);

  // ── Close a file ────────────────────────────────────────────────────
  const closeFile = useCallback((fileId) => {
    // Cancel any pending write buffer for this file
    const timer = writeBufferTimers.current.get(fileId);
    if (timer) {
      clearTimeout(timer);
      writeBufferTimers.current.delete(fileId);
    }

    setOpenFiles((prev) => {
      const filtered = prev.filter((f) => f.fileId !== fileId);
      // Use ref for current activeFileId to avoid stale closure
      if (activeFileIdRef.current === fileId) {
        const newActive = filtered.length > 0 ? filtered[filtered.length - 1].fileId : null;
        setActiveFileId(newActive);
      }
      return filtered;
    });

    editorService.closeFile(fileId).catch(() => {});
  }, []); // No dependencies — uses refs

  // ── Update content (from editor onChange — already debounced by Editor.jsx) ──
  const updateContent = useCallback((fileId, newContent) => {
    // Update state immediately (for UI responsiveness)
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.fileId === fileId ? { ...f, content: newContent, isDirty: true } : f
      )
    );

    // Debounce the API write — cancel previous timer for this file
    const existingTimer = writeBufferTimers.current.get(fileId);
    if (existingTimer) clearTimeout(existingTimer);

    writeBufferTimers.current.set(fileId,
      setTimeout(() => {
        driveService.updateFile(fileId, newContent).catch(() => {});
        writeBufferTimers.current.delete(fileId);
      }, 2000) // 2-second debounce on top of Editor's 500ms
    );

    editorService.markDirty(fileId, true).catch(() => {});
  }, []);

  // ── Save file (Ctrl+S — immediate flush) ────────────────────────────
  const saveFile = useCallback(async (fileId) => {
    // Read latest content from ref to avoid stale closure
    const file = openFilesRef.current.find((f) => f.fileId === fileId);
    if (!file || file.content === null) return;

    // Cancel any pending write buffer — we're flushing now
    const timer = writeBufferTimers.current.get(fileId);
    if (timer) {
      clearTimeout(timer);
      writeBufferTimers.current.delete(fileId);
    }

    setSaveStatus('saving');
    try {
      await driveService.flushFile(fileId, file.content);
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.fileId === fileId ? { ...f, isDirty: false } : f
        )
      );
      editorService.markDirty(fileId, false).catch(() => {});
      setSaveStatus('saved');

      // Reset status after 2s
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, []); // No dependencies — uses refs

  // ── Switch active tab ───────────────────────────────────────────────
  const switchTab = useCallback((fileId) => {
    setActiveFileId(fileId);

    // If content was never loaded (restored session), load it now
    const file = openFilesRef.current.find((f) => f.fileId === fileId);
    if (file && file.content === null) {
      driveService.readFile(fileId).then((res) => {
        const content = res.data?.data?.content ?? '';
        setOpenFiles((prev) =>
          prev.map((f) => f.fileId === fileId ? { ...f, content } : f)
        );
      }).catch(() => {
        setOpenFiles((prev) =>
          prev.map((f) => f.fileId === fileId && f.content === null ? { ...f, content: '' } : f)
        );
      });
    }

    editorService.setActiveFile(fileId).catch(() => {});
  }, []);

  // ── Cleanup all write buffer timers on unmount ──────────────────────
  useEffect(() => {
    return () => {
      writeBufferTimers.current.forEach((timer) => clearTimeout(timer));
      writeBufferTimers.current.clear();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const activeFile = openFiles.find((f) => f.fileId === activeFileId) || null;

  return (
    <EditorContext.Provider value={{
      openFiles,
      activeFileId,
      activeFile,
      saveStatus,
      cursorPosition,
      setCursorPosition,
      openFile,
      closeFile,
      updateContent,
      saveFile,
      switchTab,
    }}>
      {children}
    </EditorContext.Provider>
  );
};
