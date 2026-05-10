/**
 * Orion IDE — GoalInput Component
 *
 * Textarea with character count, example chips, and Start Building button.
 */

import React, { useState, useCallback } from 'react';

/* ── SVG Icons ────────────────────────────────────────────────────────── */

const RocketIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" d="M14.064 0a8.75 8.75 0 00-6.187 2.563l-.459.458c-.314.314-.616.641-.904.979H3.31a1.75 1.75 0 00-1.49.833L.11 7.607a.75.75 0 00.418 1.11l3.102.954c.037.051.079.1.124.145l2.429 2.428c.046.046.094.088.145.125l.954 3.102a.75.75 0 001.11.418l2.774-1.707a1.75 1.75 0 00.833-1.49V9.485c.338-.288.665-.59.979-.904l.458-.459A8.75 8.75 0 0016 1.936V1.75A1.75 1.75 0 0014.25 0h-.186zM10.5 5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm-1.482 7.482a.75.75 0 00-1.06 0 5.78 5.78 0 01-2.91 1.55.75.75 0 00.244 1.476 7.262 7.262 0 003.726-1.966.75.75 0 000-1.06z" />
  </svg>
);

const SparkleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M7.53 1.282a.5.5 0 01.94 0l1.478 4.03a.5.5 0 00.296.296l4.03 1.478a.5.5 0 010 .94l-4.03 1.478a.5.5 0 00-.296.296l-1.478 4.03a.5.5 0 01-.94 0l-1.478-4.03a.5.5 0 00-.296-.296l-4.03-1.478a.5.5 0 010-.94l4.03-1.478a.5.5 0 00.296-.296L7.53 1.282z" />
  </svg>
);

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
        <SparkleIcon />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#c9d1d9' }}>
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
            background: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 8,
            color: '#c9d1d9',
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
          onFocus={(e) => { e.target.style.borderColor = '#58a6ff'; }}
          onBlur={(e) => { e.target.style.borderColor = '#30363d'; }}
        />
        {/* Character count */}
        <span style={{
          position: 'absolute', bottom: 8, right: 12,
          fontSize: 11, color: goal.length > MAX_CHARS * 0.9 ? '#f85149' : '#484f58',
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
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: 16,
              color: '#7d8590',
              fontSize: 11,
              padding: '4px 10px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontFamily: "'Inter', sans-serif",
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isRunning) {
                e.currentTarget.style.borderColor = '#58a6ff';
                e.currentTarget.style.color = '#c9d1d9';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#21262d';
              e.currentTarget.style.color = '#7d8590';
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
          background: goal.trim() && !isRunning ? 'linear-gradient(135deg, #238636, #2ea043)' : '#21262d',
          color: goal.trim() && !isRunning ? '#ffffff' : '#484f58',
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
            e.currentTarget.style.background = 'linear-gradient(135deg, #2ea043, #3fb950)';
          }
        }}
        onMouseLeave={(e) => {
          if (goal.trim() && !isRunning) {
            e.currentTarget.style.background = 'linear-gradient(135deg, #238636, #2ea043)';
          }
        }}
      >
        <RocketIcon />
        {isRunning ? 'Building...' : 'Start Building'}
      </button>
    </div>
  );
};

export default GoalInput;
