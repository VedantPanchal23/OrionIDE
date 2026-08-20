/**
 * Yjs + Monaco live collaboration (optional).
 * Connects to editor-service /ws/editor with ?yjs=1&roomId=
 *
 * Client gate: VITE_ENABLE_YJS_COLLAB=true (or import.meta.env.DEV with same)
 * plus entitlements.features.collab — avoids reconnect storms when server flag is off.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { SimpleMonacoBinding } from './simpleMonacoBinding';
import { getAccessToken } from '../../services/api';

function editorWsBase() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  if (import.meta.env.DEV && !import.meta.env.VITE_WS_HOST) {
    return `${proto}://${window.location.hostname}:3003/ws`;
  }
  const host = import.meta.env.VITE_WS_HOST || window.location.host;
  return `${proto}://${host}/api/editor/ws`;
}

export function isCollabClientEnabled() {
  const flag = import.meta.env.VITE_ENABLE_YJS_COLLAB;
  if (flag === 'false' || flag === '0') return false;
  if (flag === 'true' || flag === '1') return true;
  // Default on in DEV when compose has ENABLE_YJS_COLLAB; off in prod unless flagged
  return Boolean(import.meta.env.DEV);
}

/**
 * @returns {{ dispose: () => void, awareness: import('y-protocols/awareness').Awareness } | null}
 */
export function bindMonacoCollab({
  editor, roomId, userName = 'Orion user', enabled = true,
}) {
  if (!enabled || !isCollabClientEnabled() || !editor || !roomId) return null;
  const token = getAccessToken();
  if (!token) return null;

  const ydoc = new Y.Doc();
  const ytext = ydoc.getText('monaco');
  let binding = null;
  let disposed = false;

  const provider = new WebsocketProvider(editorWsBase(), 'editor', ydoc, {
    params: {
      token,
      yjs: '1',
      roomId: String(roomId),
    },
    // Avoid aggressive reconnect loops when server rejects Yjs
    maxBackoffTime: 10000,
  });

  provider.awareness.setLocalStateField('user', {
    name: userName,
    color: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
  });

  const model = editor.getModel();
  if (!model) {
    provider.destroy();
    ydoc.destroy();
    return null;
  }

  const startBinding = () => {
    if (disposed || binding) return;
    binding = new SimpleMonacoBinding(ytext, model, new Set([editor]));
  };

  // Wait for first sync so we don't seed an empty doc and clobber peers
  if (provider.synced) {
    startBinding();
  } else {
    provider.once('sync', (synced) => {
      if (synced) startBinding();
    });
    // Fallback if sync event is missed
    setTimeout(() => {
      if (!disposed && !binding) startBinding();
    }, 1500);
  }

  provider.on('connection-error', () => {
    // Stop hammering if server closed (e.g. YJS_DISABLED)
    try { provider.disconnect(); } catch { /* ignore */ }
  });

  return {
    awareness: provider.awareness,
    dispose: () => {
      disposed = true;
      try { binding?.destroy(); } catch { /* ignore */ }
      binding = null;
      try { provider.destroy(); } catch { /* ignore */ }
      try { ydoc.destroy(); } catch { /* ignore */ }
    },
  };
}
