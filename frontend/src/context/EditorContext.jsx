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
  const saveTimeoutRef = useRef(null);

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

  // ── Open a file ────────────────────────────────────────────────────
  const openFile = useCallback(async (fileId, fileName) => {
    // Check if already open
    const existing = openFiles.find((f) => f.fileId === fileId);
    if (existing) {
      setActiveFileId(fileId);
      editorService.setActiveFile(fileId).catch(() => {});
      return;
    }

    const langInfo = getLanguageFromFileName(fileName);

    // Load content from Drive
    let content = '';
    try {
      const res = await driveService.readFile(fileId);
      content = res.data?.data?.content || '';
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

    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFileId(fileId);

    // Sync with backend session
    editorService.openFile(fileId, fileName, langInfo.monacoLanguage).catch(() => {});
  }, [openFiles]);

  // ── Close a file ────────────────────────────────────────────────────
  const closeFile = useCallback((fileId) => {
    setOpenFiles((prev) => {
      const filtered = prev.filter((f) => f.fileId !== fileId);
      // If closing active file, switch to last open
      if (activeFileId === fileId) {
        const newActive = filtered.length > 0 ? filtered[filtered.length - 1].fileId : null;
        setActiveFileId(newActive);
      }
      return filtered;
    });

    editorService.closeFile(fileId).catch(() => {});
  }, [activeFileId]);

  // ── Update content (from editor onChange) ────────────────────────────
  const updateContent = useCallback((fileId, newContent) => {
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.fileId === fileId ? { ...f, content: newContent, isDirty: true } : f
      )
    );

    // Buffer write (debounced at the component level)
    driveService.updateFile(fileId, newContent).catch(() => {});
    editorService.markDirty(fileId, true).catch(() => {});
  }, []);

  // ── Save file (Ctrl+S — immediate flush) ────────────────────────────
  const saveFile = useCallback(async (fileId) => {
    const file = openFiles.find((f) => f.fileId === fileId);
    if (!file) return;

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
  }, [openFiles]);

  // ── Switch active tab ───────────────────────────────────────────────
  const switchTab = useCallback((fileId) => {
    setActiveFileId(fileId);
    editorService.setActiveFile(fileId).catch(() => {});
  }, []);

  const activeFile = openFiles.find((f) => f.fileId === activeFileId) || null;

  return (
    <EditorContext.Provider value={{
      openFiles,
      activeFileId,
      activeFile,
      saveStatus,
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
