/**
 * Orion IDE — useTerminal Hook
 *
 * Manages terminal output state and SSE connection lifecycle.
 */

import { useState, useCallback, useRef } from 'react';
import { executeFile, streamExecution } from '../services/executionService';
import { getLanguageFromFileName } from '../utils/languageMap';

/**
 * @typedef {{ text: string, type: 'stdout'|'stderr'|'system'|'info' }} TerminalLine
 */

const useTerminal = () => {
  const [lines, setLines] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const eventSourceRef = useRef(null);

  const appendLine = useCallback((text, type = 'stdout') => {
    setLines((prev) => [...prev, { text, type, timestamp: Date.now() }]);
  }, []);

  const clearTerminal = useCallback(() => {
    setLines([]);
  }, []);

  /**
   * Execute code and stream output to the terminal.
   *
   * @param {string} fileName
   * @param {string} code
   * @param {string} [stdin]
   */
  const runCode = useCallback(async (fileName, code, stdin) => {
    if (isRunning) return;

    // Clean up previous connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const langInfo = getLanguageFromFileName(fileName);
    const language = langInfo.pistonLanguage;

    if (!language) {
      appendLine(`Cannot execute ${langInfo.displayName} files`, 'system');
      return;
    }

    setIsRunning(true);
    appendLine(`Running ${fileName} (${langInfo.displayName})...`, 'system');

    try {
      const { executionId } = await executeFile(language, fileName, code, stdin);

      eventSourceRef.current = streamExecution(executionId, {
        onStdout: (data) => {
          // Split by newlines if multi-line output
          const outputLines = data.split('\n');
          outputLines.forEach((line) => {
            if (line !== '') {
              appendLine(line, 'stdout');
            }
          });
        },
        onStderr: (data) => {
          const outputLines = data.split('\n');
          outputLines.forEach((line) => {
            if (line !== '') {
              appendLine(line, 'stderr');
            }
          });
        },
        onExit: (data) => {
          const exitMsg = data.timedOut
            ? `Execution timed out after ${data.time}s`
            : `Process exited with code ${data.exitCode} (${data.time}s)`;
          appendLine(exitMsg, data.exitCode === 0 ? 'info' : 'system');
          setIsRunning(false);
          eventSourceRef.current = null;
        },
        onError: (data) => {
          appendLine(`Error: ${data.message || 'Execution failed'}`, 'stderr');
          setIsRunning(false);
          eventSourceRef.current = null;
        },
      });
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to start execution';
      appendLine(`Error: ${msg}`, 'stderr');
      setIsRunning(false);
    }
  }, [isRunning, appendLine]);

  /**
   * Stop the current execution (closes SSE stream).
   */
  const stopExecution = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRunning(false);
    appendLine('Execution stopped by user', 'system');
  }, [appendLine]);

  return {
    lines,
    isRunning,
    appendLine,
    clearTerminal,
    runCode,
    stopExecution,
  };
};

export default useTerminal;
