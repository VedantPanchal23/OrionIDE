import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import * as agentService from '../../services/agentService';
import { useModelSettings } from '../../context/ModelSettingsContext';
import { useToast } from '../../context/ToastContext';
import { Spinner } from '../ui/primitives';
import { formatApiError } from '../../utils/apiError';
import { formatShortcut } from '../../utils/platform';

/**
 * Floating Ctrl/Cmd+K prompt over the active Monaco editor.
 */
export default function InlineEditBar({
  open,
  onClose,
  editor,
  monaco,
  language,
  filePath,
  projectFolderId,
}) {
  const models = useModelSettings();
  const toast = useToast();
  const inputRef = useRef(null);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState(null);
  const rangeRef = useRef(null);
  const originalRef = useRef('');

  useEffect(() => {
    if (!open || !editor || !monaco) return undefined;

    const sel = editor.getSelection();
    let range = sel;
    let text = editor.getModel()?.getValueInRange(sel) || '';
    if (!text || sel.isEmpty()) {
      const line = sel.startLineNumber;
      const model = editor.getModel();
      const maxCol = model.getLineMaxColumn(line);
      range = new monaco.Range(line, 1, line, maxCol);
      text = model.getValueInRange(range);
    }
    rangeRef.current = range;
    originalRef.current = text;
    setInstruction('');
    setProposal(null);
    setBusy(false);

    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open, editor, monaco]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const submit = useCallback(async () => {
    const instr = instruction.trim();
    if (!instr || busy || !editor) return;
    setBusy(true);
    setProposal(null);
    try {
      const model = editor.getModel();
      const range = rangeRef.current;
      const start = Math.max(1, (range?.startLineNumber || 1) - 12);
      const end = Math.min(model.getLineCount(), (range?.endLineNumber || 1) + 12);
      const surrounding = model.getValueInRange(
        new monaco.Range(start, 1, end, model.getLineMaxColumn(end)),
      );

      const llm = models.configured
        ? {
          provider: models.provider,
          model: models.model,
          apiKey: models.apiKey,
          baseUrl: models.baseUrl,
        }
        : null;
      if (!llm) {
        toast.info('Using server LLM keys — set BYOK in Settings for your own model');
      }

      const data = await agentService.inlineEdit({
        instruction: instr,
        code: originalRef.current,
        language,
        filePath,
        surrounding,
        llm,
        projectFolderId,
      });
      setProposal(data?.edited ?? '');
    } catch (err) {
      toast.error(formatApiError(err, 'Inline edit failed'));
    } finally {
      setBusy(false);
    }
  }, [
    instruction, busy, editor, monaco, models, toast, language, filePath, projectFolderId,
  ]);

  const accept = useCallback(() => {
    if (proposal == null || !editor || !monaco || !rangeRef.current) return;
    const range = rangeRef.current;
    editor.executeEdits('orion-inline-edit', [{
      range,
      text: proposal,
      forceMoveMarkers: true,
    }]);
    editor.focus();
    onClose();
    toast.success('Edit applied');
  }, [proposal, editor, monaco, onClose, toast]);

  if (!open) return null;

  return (
    <div className="inline-edit-bar" role="dialog" aria-label="Inline AI edit">
      <div className="inline-edit-bar-head">
        <Sparkles size={14} aria-hidden />
        <span>Edit selection</span>
        <span className="muted inline-edit-hint">{formatShortcut('Ctrl+K')}</span>
        <button type="button" className="icon-btn" title="Close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      {!proposal && (
        <div className="inline-edit-row">
          <input
            ref={inputRef}
            className="inline-edit-input"
            placeholder="Describe the change… (Enter to run)"
            value={instruction}
            disabled={busy}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <button
            type="button"
            className="btn-primary inline-edit-go"
            disabled={busy || !instruction.trim()}
            onClick={submit}
          >
            {busy ? <Spinner /> : 'Go'}
          </button>
        </div>
      )}
      {busy && (
        <p className="muted inline-edit-status">Thinking…</p>
      )}
      {proposal != null && !busy && (
        <>
          <pre className="inline-edit-preview">{proposal || '(empty)'}</pre>
          <div className="inline-edit-actions">
            <button type="button" className="btn-primary" onClick={accept}>
              <Check size={14} />
              Accept
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setProposal(null);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              Retry
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Discard
            </button>
          </div>
        </>
      )}
    </div>
  );
}
