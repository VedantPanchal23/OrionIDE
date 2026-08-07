import {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';

const STORAGE_KEY = 'orion_model_settings';

const DEFAULTS = {
  provider: 'openrouter',
  apiKey: '',
  model: 'openai/gpt-4o-mini',
  baseUrl: '',
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

const ModelSettingsContext = createContext(null);

export function ModelSettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);

  const save = useCallback((next) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const clearKey = useCallback(() => {
    save({ apiKey: '' });
  }, [save]);

  const value = useMemo(() => ({
    ...settings,
    save,
    clearKey,
    configured: Boolean(settings.apiKey && settings.model),
    label: settings.model || 'No model',
  }), [settings, save, clearKey]);

  return (
    <ModelSettingsContext.Provider value={value}>
      {children}
    </ModelSettingsContext.Provider>
  );
}

export function useModelSettings() {
  const ctx = useContext(ModelSettingsContext);
  if (!ctx) throw new Error('useModelSettings must be used within ModelSettingsProvider');
  return ctx;
}
