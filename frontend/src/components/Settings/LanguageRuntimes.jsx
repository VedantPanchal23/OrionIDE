/**
 * Orion IDE — Language Runtimes Panel
 *
 * Shows all 18 executable languages with availability status.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getExecutableLanguages } from '../../utils/languageMap';
import api from '../../services/api';

const CheckCircle = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="#3fb950">
    <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z" />
  </svg>
);

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="#f85149">
    <path fillRule="evenodd" d="M2.343 13.657A8 8 0 1113.657 2.343 8 8 0 012.343 13.657zM6.03 4.97a.75.75 0 00-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 101.06 1.06L8 9.06l1.97 1.97a.75.75 0 101.06-1.06L9.06 8l1.97-1.97a.75.75 0 10-1.06-1.06L8 6.94 6.03 4.97z" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.001 7.001 0 0115 8a.75.75 0 01-1.5 0A5.5 5.5 0 008 2.5z" />
  </svg>
);

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
          <div style={{ fontSize: 15, fontWeight: 700, color: '#c9d1d9' }}>Language Runtimes</div>
          <div style={{ fontSize: 12, color: '#7d8590', marginTop: 2 }}>
            {languages.length} programming languages supported
          </div>
        </div>
        <button
          onClick={checkStatus}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', background: '#21262d', color: '#c9d1d9',
            border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer',
            fontSize: 12, fontWeight: 500,
          }}
        >
          <RefreshIcon />
          Check Status
        </button>
      </div>

      {/* Info box */}
      <div style={{
        padding: '10px 14px', marginBottom: 16,
        background: '#0d1117', border: '1px solid #21262d', borderRadius: 8,
        fontSize: 12, color: '#8b949e', lineHeight: '1.5',
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
                padding: '10px 14px', background: '#0d1117',
                border: '1px solid #21262d', borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: lang.color, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>
                    {lang.icon} {lang.displayName}
                  </div>
                  <div style={{ fontSize: 10, color: '#484f58', fontFamily: "'JetBrains Mono', monospace" }}>
                    {lang.extensions.join(', ')}
                  </div>
                </div>
              </div>
              <div>
                {!statusKnown ? (
                  <span style={{ fontSize: 11, color: '#484f58' }}>--</span>
                ) : available ? (
                  <CheckCircle />
                ) : (
                  <AlertIcon />
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
