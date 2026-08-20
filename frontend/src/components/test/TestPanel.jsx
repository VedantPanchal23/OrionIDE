import { useCallback, useState } from 'react';
import { FlaskConical, Play } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Spinner } from '../ui/primitives';
import * as termSession from '../../lib/terminalSession';
import { formatApiError } from '../../utils/apiError';

const PRESETS = [
  { id: 'npm', label: 'npm test', cmd: 'npm test -- --watchAll=false\n' },
  { id: 'pytest', label: 'pytest', cmd: 'python -m pytest -q\n' },
  { id: 'node', label: 'node --test', cmd: 'node --test\n' },
  { id: 'go', label: 'go test', cmd: 'go test ./...\n' },
];

function sendTermInput(cmd) {
  window.dispatchEvent(new CustomEvent('orion-term-input', { detail: { text: cmd } }));
}

/**
 * Shell-based test runner — injects commands into the active PTY via chip events.
 * TerminalView stays mounted (hidden) so listeners are always ready.
 */
export default function TestPanel({ projectId, active, onOpenTerminal }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [lastCmd, setLastCmd] = useState('');

  const run = useCallback(async (cmd) => {
    if (!projectId || busy) return;
    setBusy(true);
    setLastCmd(cmd.trim());
    try {
      await termSession.ensureSession(projectId);
      onOpenTerminal?.();
      // TerminalView stays mounted; short defer lets fit/layout settle
      await new Promise((r) => setTimeout(r, 80));
      sendTermInput(cmd);
      toast.success(`Running: ${cmd.trim()}`);
    } catch (err) {
      toast.error(formatApiError(err, 'Could not run tests'));
    } finally {
      setBusy(false);
    }
  }, [projectId, busy, toast, onOpenTerminal]);

  if (!active) {
    return <div className="editor-empty compact"><span className="muted">Tests</span></div>;
  }

  return (
    <div className="test-panel">
      <div className="test-panel-head">
        <FlaskConical size={14} />
        <span>Test runner</span>
        {busy && <Spinner size={12} />}
      </div>
      <p className="settings-hint">
        Sends commands to the active terminal. Watch output on the Terminal tab.
      </p>
      <div className="test-presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => run(p.cmd)}
          >
            <Play size={12} />
            {p.label}
          </button>
        ))}
      </div>
      {lastCmd && (
        <p className="muted test-last">
          Last:
          {' '}
          <code>{lastCmd}</code>
        </p>
      )}
    </div>
  );
}
