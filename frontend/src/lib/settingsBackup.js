/**
 * Export / import IDE preferences (local only).
 */

const KEYS = {
  theme: 'orion_theme',
  prefs: 'orion_editor_prefs',
  models: 'orion_model_settings',
  layout: 'orion_ide_layout',
};

export function exportSettings({ includeApiKey = false } = {}) {
  const read = (k) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const models = read(KEYS.models) || {};
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    theme: read(KEYS.theme),
    editorPrefs: read(KEYS.prefs),
    modelSettings: {
      ...models,
      apiKey: includeApiKey ? (models.apiKey || '') : '',
    },
    layout: read(KEYS.layout),
  };
  return payload;
}

export function importSettings(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid settings file');
  }
  const write = (k, v) => {
    if (v == null) return;
    localStorage.setItem(k, JSON.stringify(v));
  };
  if (payload.theme != null) write(KEYS.theme, payload.theme);
  if (payload.editorPrefs != null) write(KEYS.prefs, payload.editorPrefs);
  if (payload.modelSettings != null) {
    const prev = (() => {
      try { return JSON.parse(localStorage.getItem(KEYS.models) || '{}'); } catch { return {}; }
    })();
    const next = { ...prev, ...payload.modelSettings };
    if (!payload.modelSettings.apiKey) next.apiKey = prev.apiKey || '';
    write(KEYS.models, next);
  }
  if (payload.layout != null) write(KEYS.layout, payload.layout);
  return true;
}

export function downloadSettingsJson(obj, filename = 'orion-settings.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
