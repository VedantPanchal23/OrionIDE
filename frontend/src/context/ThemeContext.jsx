/**
 * Orion IDE — Theme + editor preferences context
 * Persisted to localStorage. Applies data-theme attribute to <html>.
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'orion_prefs_v1';

const DEFAULTS = {
  theme: 'dark',
  editorFontSize: 13,
  tabSize: 2,
  wordWrap: false,
  minimap: true,
  lineNumbers: true,
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function ThemeProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme', prefs.theme);
  }, [prefs]);

  const update = useCallback((patch) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleTheme = useCallback(() => {
    setPrefs((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const value = useMemo(() => ({
    ...prefs,
    setTheme: (theme) => update({ theme }),
    toggleTheme,
    setEditorFontSize: (editorFontSize) => update({ editorFontSize }),
    setTabSize: (tabSize) => update({ tabSize }),
    setWordWrap: (wordWrap) => update({ wordWrap }),
    setMinimap: (minimap) => update({ minimap }),
    setLineNumbers: (lineNumbers) => update({ lineNumbers }),
    update,
  }), [prefs, toggleTheme, update]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
