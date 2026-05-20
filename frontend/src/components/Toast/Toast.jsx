/**
 * Orion IDE — Toast Notification System
 *
 * Provides a ToastProvider + useToast hook for app-wide notifications.
 * Usage:
 *   <ToastProvider><App /></ToastProvider>
 *   const { toast } = useToast();
 *   toast({ type: 'success', title: 'Saved', message: 'File saved to Drive' });
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'var(--success)',
  error: 'var(--error)',
  warning: 'var(--warning)',
  info: 'var(--info)',
};

let toastId = 0;

function ToastItem({ item, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);
  const Icon = ICONS[item.type] || Info;

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(item.id), 300);
    }, item.duration || 4000);
    return () => clearTimeout(timerRef.current);
  }, [item.id, item.duration, onRemove]);

  const handleClose = () => {
    clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(() => onRemove(item.id), 300);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 16px', minWidth: 320, maxWidth: 420,
      background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
      animation: exiting ? 'slideOutRight 0.3s ease forwards' : 'slideInRight 0.3s ease forwards',
      position: 'relative', overflow: 'hidden',
    }}>
      <Icon size={18} color={COLORS[item.type]} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {item.title && (
          <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {item.title}
          </div>
        )}
        {item.message && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {item.message}
          </div>
        )}
      </div>
      <button onClick={handleClose} style={{
        background: 'none', border: 'none', color: 'var(--text-muted)',
        cursor: 'pointer', padding: 2, flexShrink: 0, display: 'flex',
      }}>
        <X size={14} />
      </button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, height: 2,
        background: COLORS[item.type], opacity: 0.6,
        animation: `shrink ${item.duration || 4000}ms linear forwards`,
      }} />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(item => (
          <ToastItem key={item.id} item={item} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: () => {} };
  return ctx;
}
