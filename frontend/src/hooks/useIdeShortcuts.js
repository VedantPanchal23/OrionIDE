import { useEffect } from 'react';

/** Global IDE shortcuts. Keys like 'mod+s', 'mod+shift+p', 'escape'. */
export function useIdeShortcuts(handlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

    const onKey = (e) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
      const parts = [];
      if (mod) parts.push('mod');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(key === '`' ? '`' : key);
      const chord = parts.join('+');

      const handler = handlers[chord];
      if (!handler) return;

      const tag = e.target?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;
      const passThrough = [
        'escape', 'mod+shift+p', 'mod+p', 'mod+`', 'mod+s', 'mod+enter', 'mod+k',
        'mod+b', 'mod+shift+e', 'mod+shift+f', 'mod+shift+g', 'mod+shift+o',
        'mod+\\', 'mod+w', 'mod+g', 'mod+tab', 'mod+pageup', 'mod+pagedown',
        'f12', 'shift+f12', 'alt+f12', 'f2', 'alt+shift+f',
      ];
      if (inField && !passThrough.includes(chord)) return;

      e.preventDefault();
      handler(e);
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [handlers, enabled]);
}
