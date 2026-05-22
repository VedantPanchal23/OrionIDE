/**
 * Orion IDE — XTerminal Component
 *
 * Interactive terminal using xterm.js with WebSocket connection
 * to the terminal-service PTY backend.
 *
 * Features:
 * - Full interactive shell (bash/sh/powershell)
 * - ANSI color and cursor support
 * - Auto-resize to fit container
 * - Reconnect on disconnect
 * - Web links detection
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

const XTerminal = ({ terminalId, wsUrl, isActive, onExit }) => {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // ── Initialize xterm.js ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !terminalId || !wsUrl) return;

    mountedRef.current = true;

    const term = new Terminal({
      theme: {
        background: '#010409',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#010409',
        selectionBackground: '#264f78',
        selectionForeground: '#e6edf3',
        black: '#484f58',
        red: '#f85149',
        green: '#3fb950',
        yellow: '#e3b341',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39d2c0',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      scrollback: 10000,
      allowProposedApi: true,
      drawBoldTextInBrightColors: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);

    // Small delay to allow DOM measurement before fitting
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch {}
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // ── Connect WebSocket ───────────────────────────────────────────
    connectWebSocket(term, wsUrl);

    // ── Handle user input → WebSocket ───────────────────────────────
    const inputDisposable = term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // ── Handle resize → WebSocket ───────────────────────────────────
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    // ── Cleanup ─────────────────────────────────────────────────────
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      inputDisposable.dispose();
      resizeDisposable.dispose();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId, wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket connection with reconnect ─────────────────────────────
  const connectWebSocket = useCallback((term, url) => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Connection established — xterm is ready
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'output':
            term.write(msg.data);
            break;
          case 'connected':
            // Server confirmed connection — resize to match terminal
            if (fitAddonRef.current) {
              try { fitAddonRef.current.fit(); } catch {}
            }
            break;
          case 'exit':
            term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
            if (onExit) onExit(terminalId, msg.code);
            break;
          case 'error':
            term.write(`\r\n\x1b[31m[Error: ${msg.message}]\x1b[0m\r\n`);
            break;
          default:
            break;
        }
      } catch {
        // Non-JSON data — write directly
        term.write(event.data);
      }
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;
      if (event.code !== 1000) {
        term.write('\r\n\x1b[33m[Connection lost. Reconnecting...]\x1b[0m\r\n');
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connectWebSocket(term, url);
        }, 2000);
      }
    };

    ws.onerror = () => {
      // onclose will handle reconnect
    };
  }, [terminalId, onExit]);

  // ── Re-fit on container resize or tab activation ────────────────────
  useEffect(() => {
    if (!isActive || !fitAddonRef.current) return;

    const doFit = () => {
      try { fitAddonRef.current.fit(); } catch {}
    };

    // Fit immediately when tab becomes active
    requestAnimationFrame(doFit);

    // ResizeObserver for container size changes
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(doFit);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isActive]);

  // ── Focus terminal when tab becomes active ──────────────────────────
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '4px 0 0 8px',
        background: '#010409',
      }}
    />
  );
};

export default XTerminal;
