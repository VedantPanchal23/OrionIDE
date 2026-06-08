/**
 * Orion IDE — Theme Context
 *
 * Manages theme (dark/light), editor font size, and font family.
 * Persists preferences in localStorage.
 * Applies CSS custom properties dynamically to :root.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'orion-ide-preferences';

const THEMES = {
  dark: {
    '--bg-canvas': '#010409',
    '--bg-default': '#0d1117',
    '--bg-subtle': '#161b22',
    '--bg-emphasis': '#21262d',
    '--bg-inset': '#010409',
    '--border-default': '#30363d',
    '--border-emphasis': '#484f58',
    '--border-active': '#1f6feb',
    '--text-primary': '#e6edf3',
    '--text-secondary': '#8b949e',
    '--text-muted': '#7d8590',
    '--text-disabled': '#484f58',
    '--accent-blue': '#1f6feb',
    '--accent-blue-subtle': '#388bfd',
    '--accent-green': '#238636',
    '--accent-green-emphasis': '#2ea043',
    '--accent-red': '#da3633',
    '--accent-red-emphasis': '#f85149',
    '--accent-yellow': '#e3b341',
    '--accent-purple': '#8b5cf6',
    '--success': '#3fb950',
    '--warning': '#d29922',
    '--error': '#f85149',
    '--info': '#58a6ff',
    '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
    '--shadow-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
    '--shadow-lg': '0 16px 48px rgba(0, 0, 0, 0.6)',
    '--shadow-xl': '0 24px 80px rgba(0, 0, 0, 0.8)',
  },
  light: {
    '--bg-canvas': '#ffffff',
    '--bg-default': '#f6f8fa',
    '--bg-subtle': '#f0f2f5',
    '--bg-emphasis': '#e1e4e8',
    '--bg-inset': '#ffffff',
    '--border-default': '#d0d7de',
    '--border-emphasis': '#8c959f',
    '--border-active': '#0969da',
    '--text-primary': '#1f2328',
    '--text-secondary': '#656d76',
    '--text-muted': '#6e7781',
    '--text-disabled': '#8c959f',
    '--accent-blue': '#0969da',
    '--accent-blue-subtle': '#218bff',
    '--accent-green': '#1a7f37',
    '--accent-green-emphasis': '#2da44e',
    '--accent-red': '#cf222e',
    '--accent-red-emphasis': '#d1242f',
    '--accent-yellow': '#9a6700',
    '--accent-purple': '#8250df',
    '--success': '#1a7f37',
    '--warning': '#9a6700',
    '--error': '#cf222e',
    '--info': '#0969da',
    '--shadow-sm': '0 1px 2px rgba(31, 35, 40, 0.08)',
    '--shadow-md': '0 4px 12px rgba(31, 35, 40, 0.12)',
    '--shadow-lg': '0 16px 48px rgba(31, 35, 40, 0.16)',
    '--shadow-xl': '0 24px 80px rgba(31, 35, 40, 0.2)',
  },
};

const DEFAULT_PREFS = {
  theme: 'dark',
  editorFontSize: 14,
  editorFontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  tabSize: 2,
  wordWrap: 'off',
  minimap: true,
  lineNumbers: 'on',
};

function loadPreferences() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_PREFS };
}

function savePreferences(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

export function ThemeProvider({ children }) {
  const [preferences, setPreferences] = useState(loadPreferences);

  // Apply theme CSS variables to :root whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    const themeVars = THEMES[preferences.theme] || THEMES.dark;
    Object.entries(themeVars).forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });
  }, [preferences.theme]);

  // Persist preferences whenever they change
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const setTheme = useCallback((theme) => {
    if (THEMES[theme]) {
      setPreferences((prev) => ({ ...prev, theme }));
    }
  }, []);

  const setEditorFontSize = useCallback((size) => {
    const clamped = Math.max(10, Math.min(28, Number(size) || 14));
    setPreferences((prev) => ({ ...prev, editorFontSize: clamped }));
  }, []);

  const setEditorFontFamily = useCallback((fontFamily) => {
    setPreferences((prev) => ({ ...prev, editorFontFamily: fontFamily }));
  }, []);

  const setTabSize = useCallback((tabSize) => {
    setPreferences((prev) => ({ ...prev, tabSize: Number(tabSize) || 2 }));
  }, []);

  const setWordWrap = useCallback((wordWrap) => {
    setPreferences((prev) => ({ ...prev, wordWrap }));
  }, []);

  const setMinimap = useCallback((minimap) => {
    setPreferences((prev) => ({ ...prev, minimap: Boolean(minimap) }));
  }, []);

  const setLineNumbers = useCallback((lineNumbers) => {
    setPreferences((prev) => ({ ...prev, lineNumbers }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setPreferences({ ...DEFAULT_PREFS });
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme: preferences.theme,
      editorFontSize: preferences.editorFontSize,
      editorFontFamily: preferences.editorFontFamily,
      tabSize: preferences.tabSize,
      wordWrap: preferences.wordWrap,
      minimap: preferences.minimap,
      lineNumbers: preferences.lineNumbers,
      themes: Object.keys(THEMES),
      setTheme,
      setEditorFontSize,
      setEditorFontFamily,
      setTabSize,
      setWordWrap,
      setMinimap,
      setLineNumbers,
      resetToDefaults,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export { ThemeContext };
