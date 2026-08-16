import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

const ThemeContext = createContext(null);
const KEY = 'orion_theme';
const PREFS_KEY = 'orion_editor_prefs';
const PREFS_VER = 6;

const DEFAULT_PREFS = {
  _v: PREFS_VER,
  editorFontSize: 17,
  tabSize: 2,
  wordWrap: false,
  minimap: false,
  lineNumbers: true,
  stickyScroll: true,
  formatOnSave: false,
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    if (parsed._v !== PREFS_VER) {
      if (!parsed.editorFontSize || parsed.editorFontSize < 17) parsed.editorFontSize = 17;
      if (parsed._v < 5) parsed.wordWrap = false;
      if (parsed.stickyScroll == null) parsed.stickyScroll = true;
      if (parsed.formatOnSave == null) parsed.formatOnSave = false;
      parsed._v = PREFS_VER;
    }
    return parsed;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(KEY) || 'dark');
  const [prefs, setPrefs] = useState(loadPrefs);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const patchPrefs = useCallback((patch) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme,
    editorFontSize: prefs.editorFontSize,
    setEditorFontSize: (n) => patchPrefs({ editorFontSize: n }),
    tabSize: prefs.tabSize,
    setTabSize: (n) => patchPrefs({ tabSize: n }),
    wordWrap: prefs.wordWrap,
    setWordWrap: (v) => patchPrefs({ wordWrap: Boolean(v) }),
    minimap: prefs.minimap,
    setMinimap: (v) => patchPrefs({ minimap: Boolean(v) }),
    lineNumbers: prefs.lineNumbers,
    setLineNumbers: (v) => patchPrefs({ lineNumbers: Boolean(v) }),
    stickyScroll: prefs.stickyScroll,
    setStickyScroll: (v) => patchPrefs({ stickyScroll: Boolean(v) }),
    formatOnSave: prefs.formatOnSave,
    setFormatOnSave: (v) => patchPrefs({ formatOnSave: Boolean(v) }),
  }), [theme, toggleTheme, prefs, patchPrefs]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
