import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Play } from 'lucide-react';
import { IconButton, Spinner } from '../ui/primitives';
import { executeFile, getExecutionResult } from '../../services/executionService';

function parseNotebook(raw) {
  try {
    const nb = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw;
    if (!nb || !Array.isArray(nb.cells)) {
      return {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: { kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' } },
        cells: [{ cell_type: 'code', metadata: {}, source: ['print("Hello from Orion notebook")\n'], outputs: [] }],
      };
    }
    return nb;
  } catch {
    return {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [{ cell_type: 'markdown', metadata: {}, source: ['# Invalid notebook JSON\n'] }],
    };
  }
}

function cellSource(cell) {
  const s = cell?.source;
  if (Array.isArray(s)) return s.join('');
  return String(s || '');
}

function setCellSource(cell, text) {
  return { ...cell, source: text.endsWith('\n') ? text.split(/(?<=\n)/) : [`${text}\n`] };
}

function serializeNotebook(nb) {
  return `${JSON.stringify(nb, null, 1)}\n`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function notebookLanguage(nb) {
  const name = String(nb?.metadata?.language_info?.name || nb?.metadata?.kernelspec?.language || 'python').toLowerCase();
  if (name.includes('javascript') || name === 'js' || name === 'node') return 'javascript';
  return 'python';
}

function toOutputs(result) {
  const outputs = [];
  const stdout = String(result?.stdout || result?.output || '');
  const stderr = String(result?.stderr || '');
  if (stdout) {
    outputs.push({
      output_type: 'stream',
      name: 'stdout',
      text: stdout.endsWith('\n') ? stdout.split(/(?<=\n)/) : [`${stdout}\n`],
    });
  }
  if (stderr) {
    outputs.push({
      output_type: 'stream',
      name: 'stderr',
      text: stderr.endsWith('\n') ? stderr.split(/(?<=\n)/) : [`${stderr}\n`],
    });
  }
  if (!outputs.length && result?.error) {
    outputs.push({
      output_type: 'stream',
      name: 'stderr',
      text: [`${result.error}\n`],
    });
  }
  return outputs;
}

function formatOutputText(outputs) {
  if (!Array.isArray(outputs) || !outputs.length) return '';
  return outputs.map((o) => {
    const t = Array.isArray(o.text) ? o.text.join('') : String(o.text || o.ename || '');
    const tag = o.name === 'stderr' ? '[stderr] ' : '';
    return `${tag}${t}`;
  }).join('').trimEnd();
}

async function waitForExecution(executionId, { timeoutMs = 45000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await getExecutionResult(executionId);
    if (result && (result.status === 'completed' || result.status === 'failed' || result.status === 'error' || result.exitCode != null)) {
      return result;
    }
    await sleep(300);
  }
  throw new Error('Cell execution timed out');
}

/**
 * Lightweight .ipynb editor — markdown + code cells, Piston Run for code cells.
 */
export default function NotebookEditor({
  file, onChange, onSaveShortcut, onRegisterLiveContent, onFocus,
}) {
  const [nb, setNb] = useState(() => parseNotebook(file?.content));
  const [runningIdx, setRunningIdx] = useState(null);
  const [execCount, setExecCount] = useState(0);

  useEffect(() => {
    setNb(parseNotebook(file?.content));
  }, [file?.id]);

  const liveJson = useMemo(() => serializeNotebook(nb), [nb]);

  useEffect(() => {
    if (!onRegisterLiveContent || !file?.id) return undefined;
    return onRegisterLiveContent(file.id, () => liveJson);
  }, [onRegisterLiveContent, file?.id, liveJson]);

  const commit = useCallback((next) => {
    setNb(next);
    onChange?.(serializeNotebook(next));
  }, [onChange]);

  const updateCell = (idx, text) => {
    const cells = nb.cells.map((c, i) => (i === idx ? setCellSource(c, text) : c));
    commit({ ...nb, cells });
  };

  const addCell = (type = 'code') => {
    const cell = type === 'markdown'
      ? { cell_type: 'markdown', metadata: {}, source: ['## New cell\n'] }
      : { cell_type: 'code', metadata: {}, source: ['\n'], outputs: [], execution_count: null };
    commit({ ...nb, cells: [...nb.cells, cell] });
  };

  const removeCell = (idx) => {
    if (nb.cells.length <= 1) return;
    commit({ ...nb, cells: nb.cells.filter((_, i) => i !== idx) });
  };

  const runCell = async (idx) => {
    const cell = nb.cells[idx];
    if (!cell || cell.cell_type !== 'code' || runningIdx != null) return;
    const code = cellSource(cell).trim();
    if (!code) return;
    setRunningIdx(idx);
    const nextCount = execCount + 1;
    setExecCount(nextCount);
    try {
      const lang = notebookLanguage(nb);
      const { executionId } = await executeFile(lang, `cell_${idx}.${lang === 'javascript' ? 'js' : 'py'}`, code);
      const result = await waitForExecution(executionId);
      const outputs = toOutputs(result);
      const cells = nb.cells.map((c, i) => (
        i === idx
          ? { ...c, outputs, execution_count: nextCount }
          : c
      ));
      commit({ ...nb, cells });
    } catch (err) {
      const cells = nb.cells.map((c, i) => (
        i === idx
          ? {
            ...c,
            execution_count: nextCount,
            outputs: [{
              output_type: 'stream',
              name: 'stderr',
              text: [`${err.message || 'Run failed'}\n`],
            }],
          }
          : c
      ));
      commit({ ...nb, cells });
    } finally {
      setRunningIdx(null);
    }
  };

  return (
    <div
      className="notebook-editor"
      onFocus={onFocus}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          onSaveShortcut?.();
        }
      }}
    >
      <div className="notebook-toolbar">
        <span className="muted">{file?.name || 'notebook.ipynb'}</span>
        <span className="muted notebook-hint">Run = Piston (no live kernel)</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addCell('code')}>
          <Plus size={12} />
          Code
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => addCell('markdown')}>
          <Plus size={12} />
          Markdown
        </button>
      </div>
      <div className="notebook-cells">
        {nb.cells.map((cell, idx) => (
          <div key={`${cell.cell_type}-${idx}`} className={`notebook-cell ${cell.cell_type}`}>
            <div className="notebook-cell-head">
              <span className="muted">
                [
                {cell.cell_type}
                {cell.cell_type === 'code' && cell.execution_count != null ? ` ${cell.execution_count}` : ''}
                ]
              </span>
              <span className="notebook-cell-actions">
                {cell.cell_type === 'code' && (
                  <IconButton
                    title="Run cell (Piston)"
                    disabled={runningIdx != null}
                    onClick={() => runCell(idx)}
                  >
                    {runningIdx === idx ? <Spinner size={12} /> : <Play size={12} />}
                  </IconButton>
                )}
                <IconButton title="Delete cell" onClick={() => removeCell(idx)}>
                  <Trash2 size={12} />
                </IconButton>
              </span>
            </div>
            <textarea
              className="notebook-cell-input"
              rows={Math.min(16, Math.max(3, cellSource(cell).split('\n').length + 1))}
              value={cellSource(cell)}
              onChange={(e) => updateCell(idx, e.target.value)}
              spellCheck={cell.cell_type === 'markdown'}
            />
            {cell.cell_type === 'code' && formatOutputText(cell.outputs) ? (
              <pre className="notebook-cell-output">{formatOutputText(cell.outputs)}</pre>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
