/**
 * Orion IDE — run current file, stream output into the bottom dock's Output tab
 */

import { useCallback, useRef, useState } from 'react';
import { executeFile, streamExecution } from '../services/executionService';
import { getLanguageByFileName } from '../utils/languageMap';

let lineSeq = 0;

export function useRunTerminal() {
  const [outputLines, setOutputLines] = useState([]);
  const [running, setRunning] = useState(false);
  const streamRef = useRef(null);

  const pushLine = useCallback((stream, text) => {
    setOutputLines((prev) => [...prev, { id: ++lineSeq, stream, text }]);
  }, []);

  const clear = useCallback(() => setOutputLines([]), []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    setRunning(false);
  }, []);

  const run = useCallback(async (file) => {
    if (!file || file.isFolder) return;
    const lang = getLanguageByFileName(file.name);
    if (!lang.pistonLanguage) {
      pushLine('stderr', `"${file.name}" (${lang.displayName}) is not an executable language.`);
      return;
    }

    stop();
    clear();
    setRunning(true);
    pushLine('info', `$ run ${file.name}`);

    try {
      const { executionId } = await executeFile(lang.pistonLanguage, file.name, file.content || '');
      streamRef.current = streamExecution(executionId, {
        onStdout: (data) => pushLine('stdout', data),
        onStderr: (data) => pushLine('stderr', data),
        onExit: (data) => {
          pushLine('exit', `[process exited with code ${data.exitCode ?? 0}]`);
          setRunning(false);
          streamRef.current = null;
        },
        onError: (data) => {
          pushLine('stderr', data?.message || 'Execution error');
          setRunning(false);
          streamRef.current = null;
        },
      });
    } catch (err) {
      pushLine('stderr', err?.response?.data?.error?.message || err.message || 'Failed to start execution');
      setRunning(false);
    }
  }, [pushLine, clear, stop]);

  return {
    outputLines, running, run, stop, clear,
  };
}

export default useRunTerminal;
