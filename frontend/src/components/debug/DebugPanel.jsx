import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bug, Pause, Play, SkipForward, Square, StepForward, RefreshCw, ArrowDownToLine,
} from 'lucide-react';
import * as debugApi from '../../services/debugService';
import * as driveService from '../../services/driveService';
import { useEditor } from '../../context/EditorContext';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { useToast } from '../../context/ToastContext';
import { IconButton, Spinner } from '../ui/primitives';
import * as termSession from '../../lib/terminalSession';
import { getLanguageByFileName } from '../../utils/languageMap';
import { formatApiError } from '../../utils/apiError';
import { findLaunchNode, normalizeLaunchConfigs } from '../../lib/launchConfigs';

function pickAdapterType(fileName, adapters) {
  const piston = getLanguageByFileName(fileName).pistonLanguage;
  const types = (adapters || []).map((a) => a.type);
  if (piston === 'python' && types.includes('python')) return 'python';
  if ((piston === 'javascript' || piston === 'typescript') && types.includes('node')) return 'node';
  if (types.includes(piston)) return piston;
  return types[0] || null;
}

export default function DebugPanel({ projectId, active }) {
  const {
    activeFile, openFiles, openFile, requestReveal, setPauseLine,
  } = useEditor();
  const tree = useFileTreeContext();
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stack, setStack] = useState([]);
  const [variables, setVariables] = useState([]);
  const [adapters, setAdapters] = useState([]);
  const [outputLines, setOutputLines] = useState([]);
  const [launchConfigs, setLaunchConfigs] = useState([]);
  const [selectedLaunch, setSelectedLaunch] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    debugApi.listAdapters()
      .then((res) => {
        if (!cancelled) setAdapters(res.data?.data?.adapters || []);
      })
      .catch(() => {
        if (!cancelled) {
          setAdapters([
            { type: 'python', engine: 'debugpy' },
            { type: 'node', engine: 'inspector' },
          ]);
        }
      });

    (async () => {
      try {
        const node = findLaunchNode(tree);
        if (!node?.id) {
          if (!cancelled) {
            setLaunchConfigs([]);
            setSelectedLaunch('');
          }
          return;
        }
        const res = await driveService.readFile(node.id);
        const content = res.data?.data?.content ?? res.data?.content ?? '';
        const parsed = JSON.parse(String(content).replace(/^\uFEFF/, ''));
        const configs = normalizeLaunchConfigs(parsed);
        if (!cancelled) {
          setLaunchConfigs(configs);
          setSelectedLaunch((prev) => prev || configs[0]?.name || '');
        }
      } catch {
        if (!cancelled) setLaunchConfigs([]);
      }
    })();

    return () => { cancelled = true; };
  }, [active, tree, tree.nodesById]);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => {
    clearPoll();
    setPauseLine(null);
  }, [setPauseLine]);

  const applyPausedFrame = useCallback((frames) => {
    const top = frames?.[0];
    if (!top?.line) {
      setPauseLine(null);
      return;
    }
    const name = top.path || top.source?.path || top.name;
    const match = openFiles.find((f) => f.name === name || f.name.endsWith(`/${name}`))
      || Object.values(tree.nodesById || {}).find((n) => n.name === name && !n.isFolder);
    if (match) {
      setPauseLine({ fileId: match.id, line: top.line });
      requestReveal(match.id, top.line, 1);
    } else {
      setPauseLine(null);
    }
  }, [openFiles, tree.nodesById, setPauseLine, requestReveal]);

  const refresh = useCallback(async (sessionId) => {
    if (!sessionId) return;
    try {
      const [sessRes, stackRes, varRes] = await Promise.all([
        debugApi.getSession(sessionId),
        debugApi.getStack(sessionId).catch(() => null),
        debugApi.getVariables(sessionId).catch(() => null),
      ]);
      const sess = sessRes.data?.data || null;
      setSession(sess);
      const frames = stackRes?.data?.data?.stackFrames || sess?.stackFrames || [];
      setStack(frames);
      setVariables(varRes?.data?.data?.variables || sess?.variables || []);
      const outs = (sess?.events || [])
        .filter((e) => e.type === 'output' || e.payload?.category === 'stdout' || e.payload?.category === 'stderr'
          || e.type === 'adapter_output')
        .map((e) => {
          const text = e.payload?.output || e.payload?.data || e.message || '';
          return String(text).trim();
        })
        .filter(Boolean)
        .slice(-80);
      if (outs.length) setOutputLines(outs);
      if (sess?.status === 'paused' || sess?.status === 'stopped') {
        applyPausedFrame(frames);
      }
    } catch {
      /* ignore poll errors */
    }
  }, [applyPausedFrame]);

  const startPoll = (sessionId) => {
    clearPoll();
    pollRef.current = setInterval(() => refresh(sessionId), 1200);
  };

  const relativeProgramPath = useCallback((file) => {
    if (!file?.id) return file?.name || 'main.py';
    try {
      const nodes = tree.getPath(file.id) || [];
      const parts = nodes
        .filter((n) => n && n.id !== projectId)
        .map((n) => n.name)
        .filter(Boolean);
      return parts.join('/') || file.name;
    } catch {
      return file.name;
    }
  }, [tree, projectId]);

  const pushBreakpoints = async (sessionId, file) => {
    const markers = window.__orionBreakpoints?.[file.id] || [];
    const relPath = relativeProgramPath(file);
    await debugApi.setBreakpoints(sessionId, markers.map((line) => ({
      fileId: file.id,
      path: relPath,
      line,
    })));
  };

  const start = async () => {
    const launch = launchConfigs.find((c) => c.name === selectedLaunch) || null;
    const file = activeFile || openFiles[0];

    let type = launch?.adapter || (file ? pickAdapterType(file.name, adapters) : null);
    let program = launch?.program || (file ? relativeProgramPath(file) : null);
    const stopOnEntry = launch ? launch.stopOnEntry : true;
    const args = launch?.args || [];

    if (!type || !program) {
      toast.info(launch ? 'Launch config incomplete' : 'Open a file to debug (or add .vscode/launch.json)');
      return;
    }
    const types = (adapters || []).map((a) => a.type);
    if (type && !types.includes(type) && types.length) {
      toast.error(`Adapter "${type}" not available (have: ${types.join(', ')})`);
      return;
    }

    setBusy(true);
    try {
      try {
        await termSession.ensureSession(projectId);
      } catch { /* workspace may already exist */ }

      const res = await debugApi.createSession({
        type,
        request: launch?.request || 'launch',
        program,
        projectId,
        stopOnEntry,
        args,
        cwd: launch?.cwd || undefined,
      });
      const created = res.data?.data;
      setSession(created);
      if (file) await pushBreakpoints(created.sessionId, file);
      await debugApi.sendCommand(created.sessionId, 'launch');
      startPoll(created.sessionId);
      await refresh(created.sessionId);
      toast.success(`Debug started (${type}: ${program})`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  // Live-sync breakpoints while a session is running
  useEffect(() => {
    if (!active || !session?.sessionId || !activeFile) return undefined;
    const timer = setInterval(() => {
      pushBreakpoints(session.sessionId, activeFile).catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, [active, session?.sessionId, activeFile?.id]);

  const cmd = async (command) => {
    if (!session?.sessionId) return;
    setBusy(true);
    try {
      await debugApi.sendCommand(session.sessionId, command);
      if (command === 'stop') {
        clearPoll();
        try { await debugApi.destroySession(session.sessionId); } catch { /* ignore */ }
        setSession(null);
        setStack([]);
        setVariables([]);
        setOutputLines([]);
        setPauseLine(null);
      } else {
        await refresh(session.sessionId);
      }
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const openFrame = async (frame) => {
    const name = frame.path || frame.source?.path || frame.name;
    const line = frame.line;
    if (!name || !line) return;
    const node = Object.values(tree.nodesById || {}).find((n) => n.name === name && !n.isFolder)
      || openFiles.find((f) => f.name === name);
    if (node) {
      await openFile(node, { line });
      setPauseLine({ fileId: node.id, line });
    }
  };

  if (!active) return null;

  const file = activeFile || openFiles[0];
  const adapterType = file ? pickAdapterType(file.name, adapters) : null;
  const adapterLabel = adapters.length
    ? adapters.map((a) => a.type).join(', ')
    : 'loading…';

  return (
    <div className="debug-panel">
      {launchConfigs.length > 0 && (
        <div className="debug-launch-row">
          <label className="muted" htmlFor="orion-launch-config">launch.json</label>
          <select
            id="orion-launch-config"
            className="git-branch-select"
            value={selectedLaunch}
            onChange={(e) => setSelectedLaunch(e.target.value)}
            disabled={busy || Boolean(session)}
          >
            {launchConfigs.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
                {' '}
                (
                {c.adapter}
                :
                {c.program}
                )
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="debug-toolbar">
        <IconButton title="Start" onClick={start} disabled={busy || (!adapterType && !selectedLaunch)}>
          {busy && !session ? <Spinner size={12} /> : <Bug size={13} />}
        </IconButton>
        <IconButton title="Continue" onClick={() => cmd('continue')} disabled={!session || busy}>
          <Play size={13} />
        </IconButton>
        <IconButton title="Pause" onClick={() => cmd('pause')} disabled={!session || busy}>
          <Pause size={13} />
        </IconButton>
        <IconButton title="Step Over" onClick={() => cmd('next')} disabled={!session || busy}>
          <SkipForward size={13} />
        </IconButton>
        <IconButton title="Step In" onClick={() => cmd('stepIn')} disabled={!session || busy}>
          <StepForward size={13} />
        </IconButton>
        <IconButton title="Step Out" onClick={() => cmd('stepOut')} disabled={!session || busy}>
          <ArrowDownToLine size={13} />
        </IconButton>
        <IconButton title="Stop" onClick={() => cmd('stop')} disabled={!session || busy}>
          <Square size={13} />
        </IconButton>
        <IconButton title="Refresh" onClick={() => refresh(session?.sessionId)} disabled={!session}>
          <RefreshCw size={12} />
        </IconButton>
        <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
          {session
            ? `${session.status} · ${session.type}`
            : (adapterType
              ? `Ready (${adapterType}) — adapters: ${adapterLabel}`
              : `No adapter for this file — available: ${adapterLabel}`)}
        </span>
      </div>

      <div className="debug-body">
        <div className="debug-col">
          <div className="search-section-label">Call stack</div>
          <ul className="debug-list">
            {stack.length === 0 && <li className="muted">—</li>}
            {stack.map((f) => (
              <li key={f.id || `${f.name}-${f.line}`}>
                <button type="button" className="debug-frame" onClick={() => openFrame(f)}>
                  {f.name}
                  {' '}
                  <span className="muted">
                    {f.path || ''}
                    :
                    {f.line}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="debug-col">
          <div className="search-section-label">Variables</div>
          <ul className="debug-list">
            {variables.length === 0 && <li className="muted">—</li>}
            {variables.map((v, i) => (
              <li key={`${v.name}-${i}`}>
                <strong>{v.name}</strong>
                {' = '}
                <span className="muted">{String(v.value ?? v.result ?? '')}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="debug-col debug-console-col">
          <div className="search-section-label">Debug console</div>
          <pre className="debug-console">
            {outputLines.length === 0 ? '—' : outputLines.join('\n')}
          </pre>
        </div>
      </div>
    </div>
  );
}
