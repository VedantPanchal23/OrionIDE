import { useCallback, useRef, useState } from 'react';
import { executeFile, getExecutionResult, getExecutionStreamUrl } from '../services/executionService';
import { getLanguageByFileName } from '../utils/languageMap';
import { useEditor } from '../context/EditorContext';
import { formatApiError } from '../utils/apiError';

function parseStreamChunk(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed.data === 'string') return parsed.data;
    return raw;
  } catch {
    return raw;
  }
}

export function useRunTerminal() {
  const { getLiveContent, saveFile } = useEditor();
  const [outputLines, setOutputLines] = useState([]);
  const [running, setRunning] = useState(false);
  const [stdin, setStdin] = useState('');
  const abortRef = useRef(null);

  const pushLine = useCallback((kind, text) => {
    const raw = text == null ? '' : String(text);
    // Keep multi-line stdout as one block so Output matches real program output.
    setOutputLines((prev) => [...prev, { kind, text: raw, at: Date.now() }]);
  }, []);

  const clear = useCallback(() => setOutputLines([]), []);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setRunning(false);
  }, []);

  const run = useCallback(async (file, stdinOverride) => {
    if (!file) return;
    stop();
    setRunning(true);
    clear();
    const lang = getLanguageByFileName(file.name);
    const input = typeof stdinOverride === 'string' ? stdinOverride : stdin;
    const started = Date.now();
    pushLine('info', `Running ${file.name}…`);
    if (input) pushLine('info', `stdin (${input.length} chars)`);

    try {
      // Save + run MUST use the same live editor buffer (not a stale React snapshot).
      let code = getLiveContent(file.id);
      try {
        const saved = await saveFile(file.id);
        if (typeof saved === 'string') code = saved;
        pushLine('info', 'Saved');
      } catch (err) {
        pushLine('stderr', `Save warning: ${formatApiError(err)}`);
        code = getLiveContent(file.id);
      }

      const { executionId } = await executeFile(lang.languageId || lang.pistonLanguage, file.name, code, input);
      const controller = new AbortController();
      abortRef.current = controller;

      let streamOk = false;
      let exitCode = null;
      try {
        await new Promise((resolve, reject) => {
          const es = new EventSource(getExecutionStreamUrl(executionId));
          let settled = false;
          const finish = (ok) => {
            if (settled) return;
            settled = true;
            streamOk = ok;
            es.close();
            if (ok) resolve();
            else reject(new Error('stream_failed'));
          };

          es.addEventListener('stdout', (e) => {
            pushLine('stdout', parseStreamChunk(e.data));
          });
          es.addEventListener('stderr', (e) => {
            pushLine('stderr', parseStreamChunk(e.data));
          });
          es.addEventListener('exit', (e) => {
            try {
              const payload = JSON.parse(e.data);
              exitCode = payload.exitCode ?? 0;
              const secs = payload.time || ((Date.now() - started) / 1000).toFixed(2);
              pushLine('info', `Exit ${exitCode} · ${secs}s`);
            } catch {
              pushLine('info', 'Exit');
            }
            finish(true);
          });
          es.addEventListener('error', (e) => {
            try {
              const payload = JSON.parse(e.data);
              pushLine('stderr', payload.message || e.data);
            } catch {
              pushLine('stderr', e.data || 'Execution error');
            }
            finish(true);
          });
          es.onerror = () => {
            if (settled) return;
            finish(false);
          };
          controller.signal.addEventListener('abort', () => {
            if (!settled) {
              settled = true;
              es.close();
              resolve();
            }
          });
        });
      } catch {
        if (!streamOk) {
          const result = await getExecutionResult(executionId);
          if (result?.stdout) pushLine('stdout', result.stdout);
          if (result?.stderr) pushLine('stderr', result.stderr);
          exitCode = result?.exitCode ?? 0;
          pushLine('info', `Exit ${exitCode}`);
        }
      }
      return { ok: exitCode === 0, exitCode };
    } catch (err) {
      pushLine('stderr', formatApiError(err, 'Run failed'));
      return { ok: false, exitCode: -1 };
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [getLiveContent, saveFile, pushLine, clear, stop, stdin]);

  return {
    outputLines, running, run, stop, clear, stdin, setStdin,
  };
}
