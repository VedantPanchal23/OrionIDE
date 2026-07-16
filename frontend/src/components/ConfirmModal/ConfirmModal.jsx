/**
 * Orion IDE — Confirm Modal
 *
 * A lightweight, promise-based confirmation dialog.
 * Usage:
 *   const { confirmRef, ConfirmModal } = useConfirm();
 *   // In JSX: <ConfirmModal ref={confirmRef} />
 *   // Calling: const ok = await confirmRef.current.show({ title, message, danger })
 */

import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { AlertTriangle, Trash2, X, Check } from 'lucide-react';

const ConfirmModal = forwardRef((_, ref) => {
  const [state, setState] = useState(null); // { title, message, danger, resolve }

  useImperativeHandle(ref, () => ({
    show: ({ title, message, danger = false, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) =>
      new Promise((resolve) => {
        setState({ title, message, danger, confirmLabel, cancelLabel, resolve });
      }),
  }));

  if (!state) return null;

  const handleConfirm = () => {
    const { resolve } = state;
    setState(null);
    resolve(true);
  };

  const handleCancel = () => {
    const { resolve } = state;
    setState(null);
    resolve(false);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={handleCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, background: 'var(--bg-default)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          animation: 'slideIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '18px 20px 12px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          {state.danger
            ? <AlertTriangle size={18} color="var(--warning)" />
            : <AlertTriangle size={18} color="var(--info)" />
          }
          <span style={{
            fontSize: 'var(--font-size-base)', fontWeight: 600,
            color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
          }}>
            {state.title}
          </span>
          <button
            onClick={handleCancel}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
              display: 'flex', borderRadius: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '14px 20px',
          fontSize: 'var(--font-size-md)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          lineHeight: 1.5,
        }}>
          {state.message}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 8, padding: '12px 20px 16px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '7px 16px', background: 'var(--bg-emphasis)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
              cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-ui)', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
          >
            <X size={13} /> {state.cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '7px 16px',
              background: state.danger ? 'var(--accent-red)' : 'var(--accent-blue)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: '#fff', cursor: 'pointer',
              fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-ui)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = state.danger ? 'var(--accent-red-emphasis)' : 'var(--accent-green)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = state.danger ? 'var(--accent-red)' : 'var(--accent-blue)';
            }}
          >
            {state.danger ? <Trash2 size={13} /> : <Check size={13} />}
            {state.confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: scale(0.95) translateY(-8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
});

ConfirmModal.displayName = 'ConfirmModal';
export default ConfirmModal;
