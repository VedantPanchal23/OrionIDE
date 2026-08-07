import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import * as termSession from '../../lib/terminalSession';

export default function TerminalView({ projectId, active }) {
  const hostRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current || !projectId) return undefined;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "'IBM Plex Mono', Consolas, monospace",
      fontSize: 13,
      theme: {
        background: '#0a0b0f',
        foreground: '#e8e6e1',
        cursor: '#d4a84b',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    let disposed = false;

    (async () => {
      try {
        const session = await termSession.ensureSession(projectId);
        if (disposed) return;
        const ws = new WebSocket(session.wsUrl);
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'output') term.write(msg.data || '');
            if (msg.type === 'exit') term.writeln(`\r\n[process exited ${msg.code}]`);
          } catch {
            term.write(ev.data);
          }
        };
        ws.onerror = () => term.writeln('\r\n[websocket error]');
        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });
        term.onResize(({ cols, rows }) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        });
      } catch (err) {
        term.writeln(`\r\n[failed to start terminal: ${err.message}]`);
      }
    })();

    const onResize = () => {
      try { fit.fit(); } catch { /* ignore */ }
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      try { wsRef.current?.close(); } catch { /* ignore */ }
      try { term.dispose(); } catch { /* ignore */ }
      // Keep the backend session alive for dock tab switches; destroy on project change via ensureSession
    };
  }, [projectId]);

  useEffect(() => {
    if (active) {
      try { fitRef.current?.fit(); } catch { /* ignore */ }
      termRef.current?.focus();
    }
  }, [active]);

  return <div className="xterm-host" ref={hostRef} />;
}
