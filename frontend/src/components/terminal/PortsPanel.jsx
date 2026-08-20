import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Plus, RefreshCw, Trash2, Radio } from 'lucide-react';
import * as terminalService from '../../services/terminalService';
import { getAccessToken } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatApiError } from '../../utils/apiError';
import { IconButton, Spinner } from '../ui/primitives';

const QUICK_PORTS = [
  { port: 5173, label: 'Vite' },
  { port: 3000, label: 'Node' },
  { port: 8080, label: 'HTTP' },
  { port: 5000, label: 'Flask' },
  { port: 8000, label: 'FastAPI / Django' },
];

const POLL_MS = 4000;

function openProxyUrl(port) {
  const token = getAccessToken() || '';
  const base = `/api/terminal/proxy/${port}/`;
  const url = token ? `${base}?token=${encodeURIComponent(token)}` : base;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function PortsPanel({ projectId, active }) {
  const toast = useToast();
  const [ports, setPorts] = useState([]);
  const [listening, setListening] = useState([]);
  const [loading, setLoading] = useState(false);
  const [port, setPort] = useState('');
  const [label, setLabel] = useState('');
  const [protocol, setProtocol] = useState('http');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async ({ quiet } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const data = await terminalService.listPorts({ detect: true });
      setPorts(Array.isArray(data.ports) ? data.ports : []);
      setListening(Array.isArray(data.listening) ? data.listening : []);
    } catch (err) {
      setPorts([]);
      setListening([]);
      if (active && !quiet) toast.error(formatApiError(err, 'Failed to load ports'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [active, toast]);

  useEffect(() => {
    if (!active) return undefined;
    refresh();
    const id = setInterval(() => refresh({ quiet: true }), POLL_MS);
    return () => clearInterval(id);
  }, [active, refresh]);

  const visible = useMemo(() => {
    if (!projectId) return ports;
    return ports.filter((p) => !p.projectId || p.projectId === projectId);
  }, [ports, projectId]);

  const registeredSet = useMemo(
    () => new Set(visible.map((p) => Number(p.port))),
    [visible],
  );

  const listeningSet = useMemo(
    () => new Set(listening.map((l) => Number(l.port))),
    [listening],
  );

  const detectedUnregistered = useMemo(
    () => listening.filter((l) => !registeredSet.has(Number(l.port))),
    [listening, registeredSet],
  );

  // Auto-register common detected ports (Vite/Node) so Open works with one click.
  useEffect(() => {
    if (!active || busy) return undefined;
    const AUTO = new Set([5173, 3000, 5000, 8000, 8080]);
    const pending = detectedUnregistered
      .map((d) => Number(d.port))
      .filter((p) => AUTO.has(p));
    if (pending.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      for (const p of pending) {
        if (cancelled) break;
        try {
          const label = QUICK_PORTS.find((q) => q.port === p)?.label || `Port ${p}`;
          await terminalService.registerPort({ port: p, label, protocol: 'http', projectId });
        } catch {
          /* ignore races */
        }
      }
      if (!cancelled) refresh({ quiet: true });
    })();
    return () => { cancelled = true; };
  }, [active, busy, detectedUnregistered, projectId, refresh]);

  const add = async (n, lbl, proto = protocol) => {
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      toast.error('Enter a valid port (1-65535)');
      return;
    }
    setBusy(true);
    try {
      await terminalService.registerPort({
        port: n,
        label: (lbl || label).trim() || undefined,
        protocol: proto || 'http',
        projectId,
      });
      setPort('');
      setLabel('');
      toast.success(`Port ${n} registered`);
      await refresh({ quiet: true });
    } catch (err) {
      toast.error(formatApiError(err, 'Could not register port'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    try {
      await terminalService.unregisterPort(id);
      await refresh({ quiet: true });
    } catch (err) {
      toast.error(formatApiError(err, 'Could not remove port'));
    } finally {
      setBusy(false);
    }
  };

  if (!active) return null;

  return (
    <div className="ports-panel">
      <div className="ports-toolbar">
        <span className="muted">
          HTTP proxy to workspace ports
          {listening.length > 0 && (
            <>
              {' · '}
              {listening.length}
              {' '}
              listening
            </>
          )}
        </span>
        <IconButton title="Refresh + scan" onClick={() => refresh()} disabled={loading}>
          {loading ? <Spinner size={11} /> : <RefreshCw size={12} />}
        </IconButton>
      </div>

      {detectedUnregistered.length > 0 && (
        <div className="ports-detected">
          <span className="search-section-label">Detected</span>
          <div className="ports-quick">
            {detectedUnregistered.map((d) => (
              <button
                key={d.port}
                type="button"
                className="ports-chip ports-chip-live"
                disabled={busy}
                onClick={() => add(d.port, `Detected ${d.port}`)}
                title={`Register ${d.port}`}
              >
                {d.port}
                {' '}
                <span className="ports-live-dot" aria-hidden="true" />
                <span className="muted">live</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ports-quick">
        {QUICK_PORTS.map((q) => (
          <button
            key={q.port}
            type="button"
            className={`ports-chip ${listeningSet.has(q.port) ? 'ports-chip-live' : ''}`}
            disabled={busy || registeredSet.has(q.port)}
            onClick={() => add(q.port, q.label)}
            title={registeredSet.has(q.port) ? 'Already registered' : `Register ${q.port}`}
          >
            {q.port}
            {' '}
            <span className="muted">{q.label}</span>
            {listeningSet.has(q.port) && <span className="ports-live-dot" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="ports-form">
        <input
          type="number"
          min={1}
          max={65535}
          placeholder="Port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
        />
        <input
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select
          className="ports-protocol"
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
          title="Protocol"
          aria-label="Protocol"
        >
          <option value="http">http</option>
          <option value="https">https</option>
        </select>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => add(Number(port), label)}
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      <ul className="ports-list">
        {visible.length === 0 && (
          <li className="muted" style={{ padding: 12 }}>
            Start any server in the Terminal (Flask 5000, Express 3000, Vite 5173, …).
            Detected ports auto-register — then Open.
            {' '}
            Vite tip:
            {' '}
            <code>ORION_VITE_BASE=/api/terminal/proxy/5173/ npm run dev -- --host 127.0.0.1 --port 5173</code>
          </li>
        )}
        {visible.map((p) => {
          const live = p.listening === true || listeningSet.has(Number(p.port));
          return (
            <li key={p.id || p.port} className={`ports-row ${live ? 'is-live' : ''}`}>
              <Radio size={12} />
              <span className="ports-num">{p.port}</span>
              <span className="ports-label">{p.label || '-'}</span>
              <span className="muted ports-proto">{p.protocol || 'http'}</span>
              {live
                ? <span className="ports-status ok">listening</span>
                : <span className="ports-status muted">idle</span>}
              <span className="muted ports-path" title={p.publicPath}>{p.publicPath || ''}</span>
              <IconButton title="Open proxied URL" onClick={() => openProxyUrl(p.port)}>
                <ExternalLink size={12} />
              </IconButton>
              <IconButton title="Remove" onClick={() => remove(p.id || p.port)} disabled={busy}>
                <Trash2 size={12} />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
