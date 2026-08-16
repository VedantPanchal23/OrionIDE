import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { setApiErrorHandler } from '../services/api';

const ToastContext = createContext(null);
const MAX_TOASTS = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((type, message, duration = 4000) => {
    const text = String(message || '').trim();
    if (!text) return;

    setToasts((prev) => {
      const dup = prev.find((t) => t.type === type && t.message === text);
      if (dup) {
        const existing = timers.current.get(dup.id);
        if (existing) clearTimeout(existing);
        if (duration > 0) {
          timers.current.set(dup.id, setTimeout(() => dismiss(dup.id), duration));
        }
        return prev;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return [...prev, { id, type, message: text }].slice(-MAX_TOASTS);
    });
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
  }, []);

  const api = useMemo(() => ({
    success: (m, d) => push('success', m, d),
    error: (m, d) => push('error', m, d ?? 6000),
    info: (m, d) => push('info', m, d),
    dismiss,
  }), [push, dismiss]);

  useEffect(() => {
    setApiErrorHandler((message) => {
      if (message) api.error(message, 7000);
    });
    return () => setApiErrorHandler(null);
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            {t.type === 'success' && <CheckCircle2 size={16} color="var(--success)" />}
            {t.type === 'error' && <XCircle size={16} color="var(--danger)" />}
            {t.type === 'info' && <Info size={16} color="var(--info)" />}
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
