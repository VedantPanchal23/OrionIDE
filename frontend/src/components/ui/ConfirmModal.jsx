import { useEffect, useRef } from 'react';

export default function ConfirmModal({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const focusTarget = danger ? cancelRef.current : confirmRef.current;
    const t = requestAnimationFrame(() => focusTarget?.focus());

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusable = cardRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      if (focusable.length < 2) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, danger, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        ref={cardRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title">{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
