/**
 * Orion IDE — GoalInput Component
 *
 * Textarea with character count, example chips, and Start Building button.
 */

import React, { useState, useCallback } from 'react';

import { Rocket, Sparkles } from 'lucide-react';

const MAX_CHARS = 500;

const EXAMPLE_GOALS = [
  'Python calculator with GUI',
  'React todo app with dark mode',
  'HTML portfolio page',
  'Node.js REST API',
  'Snake game in JavaScript',
];

const GoalInput = ({ onStart, isRunning }) => {
  const [goal, setGoal] = useState('');

  const handleStart = useCallback(() => {
    if (goal.trim() && !isRunning) {
      onStart(goal.trim());
    }
  }, [goal, isRunning, onStart]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey && goal.trim() && !isRunning) {
      handleStart();
    }
  };

  return (
    <div style={{ padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Sparkles size={18} color="var(--accent-blue-subtle)" />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          What would you like to build?
        </span>
      </div>

      {/* Textarea */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder="Describe your project goal..."
          rows={4}
          style={{
            width: '100%',
            background: 'var(--bg-default)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            padding: '12px 14px',
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            resize: 'vertical',
            outline: 'none',
            lineHeight: '1.5',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
            opacity: isRunning ? 0.5 : 1,
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--accent-blue-subtle)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
        />
        {/* Character count */}
        <span style={{
          position: 'absolute', bottom: 8, right: 12,
          fontSize: 11, color: goal.length > MAX_CHARS * 0.9 ? 'var(--accent-red-emphasis)' : 'var(--border-emphasis)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {goal.length}/{MAX_CHARS}
        </span>
      </div>

      {/* Example chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {EXAMPLE_GOALS.map((example) => (
          <button
            key={example}
            onClick={() => !isRunning && setGoal(example)}
            disabled={isRunning}
            style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--bg-emphasis)',
              borderRadius: 16,
              color: 'var(--text-muted)',
              fontSize: 11,
              padding: '4px 10px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontFamily: "'Inter', sans-serif",
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isRunning) {
                e.currentTarget.style.borderColor = 'var(--accent-blue-subtle)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--bg-emphasis)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {example}
          </button>
        ))}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!goal.trim() || isRunning}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 16px',
          justifyContent: 'center',
          background: goal.trim() && !isRunning ? 'linear-gradient(135deg, var(--accent-green), var(--accent-green-emphasis))' : 'var(--bg-emphasis)',
          color: goal.trim() && !isRunning ? '#ffffff' : 'var(--border-emphasis)',
          border: 'none',
          borderRadius: 8,
          cursor: !goal.trim() || isRunning ? 'not-allowed' : 'pointer',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
          transition: 'all 0.2s ease',
          boxShadow: goal.trim() && !isRunning ? '0 2px 8px rgba(35, 134, 54, 0.3)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (goal.trim() && !isRunning) {
            e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-green-emphasis), #3fb950)';
          }
        }}
        onMouseLeave={(e) => {
          if (goal.trim() && !isRunning) {
            e.currentTarget.style.background = 'linear-gradient(135deg, var(--accent-green), var(--accent-green-emphasis))';
          }
        }}
      >
        <Rocket size={16} />
        {isRunning ? 'Building...' : 'Start Building'}
      </button>
    </div>
  );
};

export default GoalInput;
