/**
 * Orion IDE — ReviewReport Component
 *
 * Displays code review results with score, issues, and approval status.
 */

import React from 'react';

/* ── SVG Icons ────────────────────────────────────────────────────────── */

const CheckCircle = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="#3fb950">
    <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z" />
  </svg>
);

const AlertCircle = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="#d29922">
    <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zM8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z" />
  </svg>
);

const CriticalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="#f85149">
    <path fillRule="evenodd" d="M2.343 13.657A8 8 0 1113.657 2.343 8 8 0 012.343 13.657zM6.03 4.97a.75.75 0 00-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 101.06 1.06L8 9.06l1.97 1.97a.75.75 0 101.06-1.06L9.06 8l1.97-1.97a.75.75 0 10-1.06-1.06L8 6.94 6.03 4.97z" />
  </svg>
);

const WarningIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="#d29922">
    <path fillRule="evenodd" d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="#58a6ff">
    <path fillRule="evenodd" d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 01-1.484.211c-.04-.282-.163-.547-.37-.847a8.695 8.695 0 00-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319a8.681 8.681 0 00-.542.681c-.208.3-.33.565-.37.847a.75.75 0 01-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75zM6 15.25a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75zM5.75 12a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" />
  </svg>
);

const getScoreColor = (score) => {
  if (score >= 8) return '#3fb950';
  if (score >= 5) return '#d29922';
  return '#f85149';
};

const getSeverityIcon = (severity) => {
  switch (severity) {
    case 'critical': return <CriticalIcon />;
    case 'warning': return <WarningIcon />;
    case 'suggestion': return <LightbulbIcon />;
    default: return <LightbulbIcon />;
  }
};

const ReviewReport = ({ review, filePath }) => {
  if (!review) return null;

  return (
    <div style={{
      background: '#0d1117', border: '1px solid #21262d', borderRadius: 8,
      overflow: 'hidden', marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', background: '#161b22', borderBottom: '1px solid #21262d',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {review.approved ? <CheckCircle /> : <AlertCircle />}
          <span style={{ fontSize: 13, fontWeight: 600, color: review.approved ? '#3fb950' : '#d29922' }}>
            {review.approved ? 'Approved by Reviewer' : 'Reviewer flagged issues'}
          </span>
        </div>

        {/* Score badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 16,
          background: '#21262d', border: `1px solid ${getScoreColor(review.score)}44`,
        }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: getScoreColor(review.score), fontFamily: "'JetBrains Mono', monospace" }}>
            {review.score}
          </span>
          <span style={{ fontSize: 10, color: '#7d8590' }}>/10</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: '10px 14px', borderBottom: review.issues?.length ? '1px solid #21262d' : 'none' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#8b949e', lineHeight: '1.5' }}>
          {review.summary}
        </p>
      </div>

      {/* Issues */}
      {review.issues?.length > 0 && (
        <div style={{ padding: '8px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#7d8590', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Issues ({review.issues.length})
          </div>
          {review.issues.map((issue, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '4px 0', fontSize: 12, color: '#c9d1d9',
            }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}>{getSeverityIcon(issue.severity)}</span>
              <span style={{ flex: 1 }}>{issue.description}</span>
              {issue.line !== null && issue.line !== undefined && (
                <span style={{ fontSize: 10, color: '#484f58', fontFamily: "'JetBrains Mono', monospace" }}>
                  L{issue.line}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewReport;
