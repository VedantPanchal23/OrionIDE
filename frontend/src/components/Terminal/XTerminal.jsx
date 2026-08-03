/**
 * Orion IDE — xterm.js host, backed by the singleton terminal session.
 */

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import * as termSession from '../../lib/terminalSession';

const XTERM_THEME = {
  background: '#0a0b0f',
  foreground: '#e8e6e1',
  cursor: '#d4a84b',
  cursorAccent: '#0a0b0f',
  selectionBackground: 'rgba(212, 168, 75, 0.28)',
  black: '#0a0b0f',
  red: '#e05d55',
  green: '#3fad7f',
  yellow: '#d4a84b',
  blue: '#6ea8c9',
  magenta: '#b892d4',
  cyan: '#6ea8c9',
  white: '#e8e6e1',
  brightBlack: '#6d6c76',
  brightRed: '#f07a72',
  brightGreen: '#5cc797',
  brightYellow: '#e0b85c',
  brightBlue: '#8cc0dd',
  brightMagenta: '#caa8e6',
  brightCyan: '#8cc0dd',
  brightWhite: '#ffffff',
};

export default function XTerminal({ projectId, visible }) {
  const hostRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
    if (!projectId || !hostRef.current) return undefined;
    let disposed = false;

    const term = new Terminal({
      convertEol: true,
      fontFamily: "'IBM Plex Mono', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      scrollback: 5000,
      theme: XTERM_THEME,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(hostRef.current);
    try { fit.fit(); } catch { /* host not measured yet */ }

    termRef.current = term;
    fitRef.current = fit;

    term.onData((data) => termSession.writeInput(data));

    const unsubscribe = termSession.subscribe((msg) => {
      if (disposed) return;
      switch (msg.type) {
        case 'replay':
        case 'output':
          term.write(msg.data || '');
          break;
        case 'connected':
          setTimeout(() => {
            if (disposed) return;
            try {
              fit.fit();
              termSession.resize(term.cols, term.rows);
            } catch { /* ignore */ }
          }, 40);
          break;
        case 'exit':
          term.write(`\r\n\x1b[2m[process exited with code ${msg.code ?? 0}]\x1b[0m\r\n`);
          break;
        case 'error':
          term.write(`\r\n\x1b[31m[terminal error] ${msg.message}\x1b[0m\r\n`);
          break;
        case 'closed':
          term.write('\r\n\x1b[2m[disconnected]\x1b[0m\r\n');
          break;
        default:
          break;
      }
    });

    termSession.ensureSession(projectId).catch((err) => {
      if (!disposed) term.write(`\r\n\x1b[31mFailed to start terminal: ${err.message}\x1b[0m\r\n`);
    });

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        try {
          fit.fit();
          termSession.resize(term.cols, term.rows);
        } catch { /* host may be hidden */ }
      });
      resizeObserver.observe(hostRef.current);
    }

    return () => {
      disposed = true;
      unsubscribe();
      resizeObserver?.disconnect();
      term.dispose();
      termSession.scheduleRelease();
    };
  }, [projectId]);

  useEffect(() => {
    if (!visible || !fitRef.current) return;
    const id = requestAnimationFrame(() => {
      try {
        fitRef.current.fit();
        if (termRef.current) termSession.resize(termRef.current.cols, termRef.current.rows);
      } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(id);
  }, [visible]);

  return <div ref={hostRef} className="dock-terminal-surface" />;
}
