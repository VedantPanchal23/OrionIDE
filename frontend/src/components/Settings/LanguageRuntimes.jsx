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
          <RefreshCw size={14} />
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
                  <CheckCircle2 size={14} color="#3fb950" />
                ) : (
                  <AlertTriangle size={14} color="#f85149" />
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
