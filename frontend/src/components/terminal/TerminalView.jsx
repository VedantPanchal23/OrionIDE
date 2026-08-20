import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { getTerminalWsUrl } from '../../services/terminalService';
import { useTheme } from '../../context/ThemeContext';
import { MONO_FONT, xtermTheme } from '../../theme/workbench';

function isLightTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

/** Host must be laid out and visible — xterm crashes if fit runs with no renderer. */
function hostReady(host) {
  if (!host?.isConnected) return false;
  if (host.clientWidth < 24 || host.clientHeight < 24) return false;
  try {
    const style = window.getComputedStyle(host);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    // Hidden ancestors (dock-pane / term-session use visibility:hidden)
    let el = host.parentElement;
    while (el) {
      const s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      if (el.classList?.contains('dock-pane') || el.classList?.contains('term-session')) {
        if (!el.classList.contains('active')) return false;
      }
      el = el.parentElement;
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * FitAddon.fit() can throw, and can also schedule Viewport._innerRefresh that
 * later reads renderService.dimensions after dispose — guard both paths.
 */
function safeFit(fit, term, host, alive) {
  if (!alive?.() || !fit || !term || !host) return;
  if (!hostReady(host)) return;
  // Renderer gone / not ready yet
  try {
    if (!term.element?.isConnected) return;
    if (term._core && !term._core._renderService) return;
  } catch {
    return;
  }
  try {
    fit.fit();
  } catch {
    /* xterm can throw before renderer dimensions exist / after dispose */
  }
}

/**
 * session: { terminalId, connectToken, wsUrl? }
 * active: terminal tab + this session selected
 * visible: dock panel is open (triggers refit after collapse)
 */
export default function TerminalView({ session, active, visible = true, onStatusChange }) {
  const { editorFontSize } = useTheme();
  const hostRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitRef = useRef(null);
  const aliveRef = useRef(false);
  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;
  const fontSize = Math.max(13, Math.min(28, Number(editorFontSize) || 16));
  const activeRef = useRef(active);
  activeRef.current = active;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const reportStatus = (status) => {
    try {
      statusRef.current?.(session?.terminalId, status);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!hostRef.current || !session?.terminalId) return undefined;

    let disposed = false;
    aliveRef.current = true;
    const isAlive = () => aliveRef.current && !disposed;
    let retries = 0;
    let reconnectTimer = null;
    let intentionalClose = false;
    let fitRaf = 0;
    let fitDebounce = null;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: MONO_FONT,
      fontSize,
      lineHeight: 1.4,
      letterSpacing: 0,
      convertEol: true,
      scrollback: 5000,
      theme: xtermTheme(isLightTheme() ? 'light' : 'dark'),
      allowTransparency: false,
      minimumContrastRatio: 4.5,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    try {
      term.loadAddon(new WebLinksAddon((_event, uri) => {
        try {
          window.open(uri, '_blank', 'noopener,noreferrer');
        } catch { /* ignore */ }
      }));
    } catch { /* optional */ }
    term.open(hostRef.current);
    // Canvas renderer: DOM glyphs can fail to paint when the dock uses
    // visibility toggles / stacking with the opaque viewport sibling.
    try {
      term.loadAddon(new CanvasAddon());
    } catch {
      /* fall back to DOM renderer */
    }
    termRef.current = term;
    fitRef.current = fit;

    const doFit = () => {
      if (!isAlive() || !visibleRef.current) return;
      safeFit(fit, term, hostRef.current, isAlive);
    };

    const fitSoon = () => {
      if (!isAlive()) return;
      if (fitRaf) cancelAnimationFrame(fitRaf);
      fitRaf = requestAnimationFrame(() => {
        fitRaf = 0;
        if (!isAlive()) return;
        // Double-rAF: wait for layout after visibility toggles
        fitRaf = requestAnimationFrame(() => {
          fitRaf = 0;
          doFit();
        });
      });
    };

    const fitDebounced = () => {
      if (fitDebounce) clearTimeout(fitDebounce);
      fitDebounce = setTimeout(() => {
        fitDebounce = null;
        fitSoon();
      }, 50);
    };

    fitSoon();

    const sendResize = () => {
      const sock = wsRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      if (term.cols && term.rows) {
        sock.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    const attachSocket = (ws) => {
      wsRef.current = ws;
      reportStatus('connecting');
      ws.onopen = () => {
        if (!isAlive()) {
          try { ws.close(); } catch { /* ignore */ }
          return;
        }
        retries = 0;
        reportStatus('connected');
        fitSoon();
        sendResize();
      };
      ws.onmessage = (ev) => {
        if (!isAlive()) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'output') term.write(msg.data || '');
          if (msg.type === 'exit') term.writeln(`\r\n[process exited ${msg.code}]`);
          if (msg.type === 'error') term.writeln(`\r\n[error] ${msg.message || 'unknown'}`);
          if (msg.type === 'connected') {
            reportStatus('connected');
          }
        } catch {
          term.write(ev.data);
        }
      };
      ws.onerror = () => {
        reportStatus('error');
      };
      ws.onclose = (ev) => {
        if (!isAlive() || intentionalClose) return;
        if (ev.code === 1000) {
          reportStatus('closed');
          return;
        }
        if (retries >= 5) {
          reportStatus('disconnected');
          try {
            term.writeln('\r\n[disconnected — click Reset on the terminal tab to retry]');
            term.writeln('[if that fails, sign in again — your session may have expired]');
          } catch { /* disposed */ }
          return;
        }
        retries += 1;
        reportStatus('reconnecting');
        const delay = Math.min(4000, 500 * retries);
        try { term.writeln(`\r\n[reconnecting ${retries}/5…]`); } catch { /* disposed */ }
        reconnectTimer = setTimeout(() => {
          if (!isAlive() || intentionalClose) return;
          connect();
        }, delay);
      };
    };

    const connect = () => {
      if (!isAlive() || intentionalClose) return;
      try {
        const prev = wsRef.current;
        if (prev) {
          prev.onopen = null;
          prev.onmessage = null;
          prev.onerror = null;
          prev.onclose = null;
          try { prev.close(); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
      const wsUrl = getTerminalWsUrl(session.terminalId, session.connectToken);
      const ws = new WebSocket(wsUrl);
      attachSocket(ws);
    };

    const openTimer = setTimeout(connect, 40);

    const dataDisp = term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });
    const resizeDisp = term.onResize(() => sendResize());

    const onResize = () => fitDebounced();
    window.addEventListener('resize', onResize);

    let ro;
    if (typeof ResizeObserver !== 'undefined' && hostRef.current) {
      ro = new ResizeObserver(() => {
        if (!isAlive() || !visibleRef.current) return;
        fitDebounced();
      });
      ro.observe(hostRef.current);
    }

    const onTheme = () => {
      if (!isAlive()) return;
      try {
        term.options.theme = xtermTheme(isLightTheme() ? 'light' : 'dark');
      } catch {
        /* ignore */
      }
    };
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const onExternalInput = (ev) => {
      if (!isAlive() || !activeRef.current) return;
      const text = ev?.detail?.text;
      if (!text || typeof text !== 'string') return;
      const sock = wsRef.current;
      if (sock?.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({ type: 'input', data: text }));
      }
    };
    window.addEventListener('orion-term-input', onExternalInput);

    return () => {
      disposed = true;
      intentionalClose = true;
      aliveRef.current = false;
      clearTimeout(openTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (fitDebounce) clearTimeout(fitDebounce);
      if (fitRaf) cancelAnimationFrame(fitRaf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orion-term-input', onExternalInput);
      try { ro?.disconnect(); } catch { /* ignore */ }
      try { mo.disconnect(); } catch { /* ignore */ }
      try { dataDisp?.dispose(); } catch { /* ignore */ }
      try { resizeDisp?.dispose(); } catch { /* ignore */ }
      reportStatus('closed');
      const sock = wsRef.current;
      wsRef.current = null;
      if (sock) {
        try {
          sock.onopen = null;
          sock.onmessage = null;
          sock.onerror = null;
          sock.onclose = null;
          if (sock.readyState === WebSocket.CONNECTING || sock.readyState === WebSocket.OPEN) {
            sock.close(1000, 'client dispose');
          }
        } catch { /* ignore */ }
      }
      fitRef.current = null;
      termRef.current = null;
      // Dispose synchronously after tearing down observers so no pending
      // Viewport refresh can touch a cleared renderService.
      try { term.dispose(); } catch { /* ignore */ }
    };
  }, [session?.terminalId, session?.connectToken, fontSize]);

  useEffect(() => {
    visibleRef.current = visible;
    if (!aliveRef.current || !visible || !active) return undefined;
    const id = requestAnimationFrame(() => {
      if (!aliveRef.current || !visibleRef.current) return;
      safeFit(fitRef.current, termRef.current, hostRef.current, () => aliveRef.current);
      try { termRef.current?.focus(); } catch { /* ignore */ }
    });
    const t = setTimeout(() => {
      if (!aliveRef.current || !visibleRef.current) return;
      safeFit(fitRef.current, termRef.current, hostRef.current, () => aliveRef.current);
    }, 100);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [active, visible]);

  return <div className="xterm-host" ref={hostRef} role="application" aria-label="Terminal" />;
}
