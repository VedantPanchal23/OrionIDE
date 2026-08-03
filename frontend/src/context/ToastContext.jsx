/**
 * Orion IDE — Toast notifications
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let idSeq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((type, message, duration = 4200) => {
    const id = `t${++idSeq}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (message, duration) => push('success', message, duration),
    error: (message, duration) => push('error', message, duration ?? 6000),
    info: (message, duration) => push('info', message, duration),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            {t.type === 'success' && <CheckCircle2 size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />}
            {t.type === 'error' && <XCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />}
            {t.type === 'info' && <Info size={16} color="var(--info)" style={{ flexShrink: 0, marginTop: 1 }} />}
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              type="button"
              className="o-icon-btn"
              style={{ width: 18, height: 18, flexShrink: 0 }}
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is colocated with its provider
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
