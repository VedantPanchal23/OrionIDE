/**
 * Orion IDE — Language Runtimes Panel
 *
 * Shows all 18 executable languages with availability status.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getExecutableLanguages } from '../../utils/languageMap';
import api from '../../services/api';

import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

const LanguageRuntimes = () => {
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const languages = getExecutableLanguages();

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/execute/languages');
      const data = res.data?.data || [];
      const statusMap = {};
      data.forEach((lang) => { statusMap[lang.id] = lang.available; });
      setStatuses(statusMap);
    } catch {
      // API unavailable — all unknown
    }
    setLoading(false);
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Language Runtimes</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {languages.length} programming languages supported
          </div>
        </div>
        <button
          onClick={checkStatus}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', background: 'var(--bg-emphasis)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: 6, cursor: 'pointer',
            fontSize: 12, fontWeight: 500,
          }}
        >
          <RefreshCw size={14} />
          Check Status
        </button>
      </div>

      {/* Info box */}
      <div style={{
        padding: '10px 14px', marginBottom: 16,
        background: 'var(--bg-default)', border: '1px solid var(--bg-emphasis)', borderRadius: 8,
        fontSize: 12, color: 'var(--text-secondary)', lineHeight: '1.5',
      }}>
        All runtimes run in a secure sandboxed container on the server. Each execution is isolated with a 30-second timeout.
      </div>

      {/* Language grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
      }}>
        {languages.map((lang) => {
          const available = statuses[lang.id];
          const statusKnown = lang.id in statuses;

          return (
            <div
              key={lang.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--bg-default)',
                border: '1px solid var(--bg-emphasis)', borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: lang.color, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {lang.icon} {lang.displayName}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--border-emphasis)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {lang.extensions.join(', ')}
                  </div>
                </div>
              </div>
              <div>
                {!statusKnown ? (
                  <span style={{ fontSize: 11, color: 'var(--border-emphasis)' }}>--</span>
                ) : available ? (
                  <CheckCircle2 size={14} color="#3fb950" />
                ) : (
                  <AlertTriangle size={14} color="var(--accent-red-emphasis)" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageRuntimes;
