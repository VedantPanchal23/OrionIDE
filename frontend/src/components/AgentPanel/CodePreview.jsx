/**
 * Orion IDE — CodePreview Component
 *
 * Read-only code display with syntax highlighting for implementer output.
 */

import React from 'react';

/* ── SVG Icons ────────────────────────────────────────────────────────── */

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
    <path fillRule="evenodd" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
  </svg>
);

const LANG_COLORS = {
  python: '#3572A5', javascript: '#f1e05a', typescript: '#3178c6',
  java: '#b07219', c: '#555555', 'c++': '#f34b7d', csharp: '#178600',
  go: '#00ADD8', rust: '#dea584', ruby: '#701516', php: '#4F5D95',
  bash: '#89e051', html: '#e34c26', css: '#563d7c',
};

const CodePreview = ({ filePath, code, language }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #21262d',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 12px', background: '#161b22', borderBottom: '1px solid #21262d',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: LANG_COLORS[language?.toLowerCase()] || '#7d8590',
          }} />
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#c9d1d9',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {filePath}
          </span>
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 3,
            background: '#21262d', color: '#7d8590',
          }}>
            {language}
          </span>
        </div>
        <button
          onClick={handleCopy}
          title="Copy code"
          style={{
            background: 'none', border: 'none', color: copied ? '#3fb950' : '#7d8590',
            cursor: 'pointer', padding: 4, display: 'flex', fontSize: 11,
            gap: 4, alignItems: 'center',
          }}
        >
          <CopyIcon />
          {copied ? 'Copied' : ''}
        </button>
      </div>

      {/* Code */}
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        <pre style={{
          margin: 0, padding: 12, fontSize: 12, lineHeight: '1.6',
          color: '#c9d1d9', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          whiteSpace: 'pre', tabSize: 4,
        }}>
          {(code || '').split('\n').map((line, i) => (
            <div key={i} style={{ display: 'flex' }}>
              <span style={{
                minWidth: 36, textAlign: 'right', paddingRight: 12,
                color: '#484f58', userSelect: 'none',
              }}>
                {i + 1}
              </span>
              <span>{line}</span>
            </div>
          ))}
        </pre>
      </div>

      {/* Footer with line count */}
      <div style={{
        padding: '4px 12px', borderTop: '1px solid #21262d',
        fontSize: 10, color: '#484f58', fontFamily: "'JetBrains Mono', monospace",
      }}>
        {code?.split('\n').length || 0} lines
      </div>
    </div>
  );
};

export default CodePreview;
