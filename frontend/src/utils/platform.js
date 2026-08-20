/** Platform-aware modifier key label for shortcuts in UI copy. */
export function isApplePlatform() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || '')
    || /Mac OS/.test(navigator.userAgent || '');
}

export function modKey() {
  return isApplePlatform() ? '⌘' : 'Ctrl';
}

/** Replace Ctrl with ⌘ on Apple in a shortcut string like "Ctrl+Shift+P". */
export function formatShortcut(shortcut = '') {
  if (!shortcut) return '';
  if (!isApplePlatform()) return shortcut;
  return String(shortcut)
    .replace(/Ctrl\+/gi, '⌘')
    .replace(/Cmd\+/gi, '⌘')
    .replace(/Alt\+/gi, '⌥')
    .replace(/Shift\+/gi, '⇧');
}

export function kbdChord(...keys) {
  return keys;
}
