import { useEffect, useRef, useState } from 'react';

/**
 * In-app prompt replacing window.prompt.
 * open + onSubmit(value) / onCancel()
 */
export default function PromptModal({
  open,
  title = 'Input',
  message,
  label = 'Value',
  initialValue = '',
  placeholder = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onSubmit,
  onCancel,
}) {
  const inputRef = useRef(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (!open) return undefined;
    setValue(initialValue);
    const t = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, initialValue, onCancel]);

  if (!open) return null;

  const submit = (e) => {
    e?.preventDefault?.();
    onSubmit?.(value);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="prompt-title">{title}</h3>
        {message && <p>{message}</p>}
        <form className="prompt-form" onSubmit={submit}>
          <label className="field">
            {label}
            <input
              ref={inputRef}
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!String(value).trim()}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
