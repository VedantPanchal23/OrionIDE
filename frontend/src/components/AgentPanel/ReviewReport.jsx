/**
 * Orion IDE — ReviewReport Component
 *
 * Displays code review results with score, issues, and approval status.
 */

import React from 'react';

import { CheckCircle2, AlertTriangle, AlertCircle as AlertCircleIcon, Lightbulb } from 'lucide-react';

const getScoreColor = (score) => {
  if (score >= 8) return '#3fb950';
  if (score >= 5) return '#d29922';
  return '#f85149';
};

const getSeverityIcon = (severity) => {
  switch (severity) {
    case 'critical': return <AlertCircleIcon size={12} color="#f85149" />;
    case 'warning': return <AlertTriangle size={12} color="#d29922" />;
    case 'suggestion': return <Lightbulb size={12} color="#58a6ff" />;
    default: return <Lightbulb size={12} color="#58a6ff" />;
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
          {review.approved ? <CheckCircle2 size={16} color="#3fb950" /> : <AlertTriangle size={16} color="#d29922" />}
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
