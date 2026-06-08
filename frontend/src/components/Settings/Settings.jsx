/**
 * Orion IDE — Settings Panel
 *
 * Sidebar settings panel for editor preferences and theme switching.
 * All values are persisted via ThemeContext → localStorage.
 */

import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  Sun,
  Moon,
  RotateCcw,
  Type,
  Columns2,
  WrapText,
  Map,
  Hash,
} from 'lucide-react';

const SettingRow = ({ icon: Icon, label, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', borderBottom: '1px solid var(--border-default)',
    gap: 12,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 'var(--font-size-md)', color: 'var(--text-primary)',
      minWidth: 0, flex: 1,
    }}>
      {Icon && <Icon size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
    <div style={{ flexShrink: 0 }}>
      {children}
    </div>
  </div>
);

const SelectInput = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      background: 'var(--bg-emphasis)', color: 'var(--text-primary)',
      border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
      padding: '4px 8px', fontSize: 'var(--font-size-sm)',
      fontFamily: 'var(--font-ui)', outline: 'none', cursor: 'pointer',
      minWidth: 100,
    }}
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

const NumberInput = ({ value, onChange, min, max, step = 1 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <button
      onClick={() => onChange(Math.max(min, value - step))}
      disabled={value <= min}
      style={stepBtnStyle}
    >−</button>
    <span style={{
      minWidth: 32, textAlign: 'center',
      fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)',
      color: 'var(--text-primary)',
    }}>{value}</span>
    <button
      onClick={() => onChange(Math.min(max, value + step))}
      disabled={value >= max}
      style={stepBtnStyle}
    >+</button>
  </div>
);

const Toggle = ({ value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    style={{
      width: 36, height: 20, borderRadius: 10,
      background: value ? 'var(--accent-blue)' : 'var(--bg-emphasis)',
      border: '1px solid var(--border-default)',
      cursor: 'pointer', position: 'relative',
      transition: 'background var(--transition-normal)',
      padding: 0,
    }}
  >
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      background: 'var(--text-primary)',
      position: 'absolute', top: 2,
      left: value ? 18 : 2,
      transition: 'left var(--transition-normal)',
    }} />
  </button>
);

const stepBtnStyle = {
  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-emphasis)', border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  cursor: 'pointer', fontSize: 14, fontWeight: 600,
  fontFamily: 'var(--font-ui)', padding: 0,
};

const Settings = () => {
  const {
    theme, editorFontSize, tabSize, wordWrap, minimap, lineNumbers,
    setTheme, setEditorFontSize, setTabSize, setWordWrap, setMinimap,
    setLineNumbers, resetToDefaults,
  } = useTheme();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      overflow: 'auto', fontFamily: 'var(--font-ui)',
    }}>
      {/* Theme */}
      <div style={{
        padding: '12px 16px 6px', fontSize: 'var(--font-size-xs)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)',
      }}>
        Appearance
      </div>

      <SettingRow icon={theme === 'dark' ? Moon : Sun} label="Theme">
        <SelectInput
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
        />
      </SettingRow>

      {/* Editor */}
      <div style={{
        padding: '16px 16px 6px', fontSize: 'var(--font-size-xs)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)',
      }}>
        Editor
      </div>

      <SettingRow icon={Type} label="Font Size">
        <NumberInput value={editorFontSize} onChange={setEditorFontSize} min={10} max={28} />
      </SettingRow>

      <SettingRow icon={Columns2} label="Tab Size">
        <SelectInput
          value={String(tabSize)}
          onChange={(v) => setTabSize(Number(v))}
          options={[
            { value: '2', label: '2 spaces' },
            { value: '4', label: '4 spaces' },
            { value: '8', label: '8 spaces' },
          ]}
        />
      </SettingRow>

      <SettingRow icon={WrapText} label="Word Wrap">
        <SelectInput
          value={wordWrap}
          onChange={setWordWrap}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
            { value: 'wordWrapColumn', label: 'Column' },
            { value: 'bounded', label: 'Bounded' },
          ]}
        />
      </SettingRow>

      <SettingRow icon={Map} label="Minimap">
        <Toggle value={minimap} onChange={setMinimap} />
      </SettingRow>

      <SettingRow icon={Hash} label="Line Numbers">
        <SelectInput
          value={lineNumbers}
          onChange={setLineNumbers}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
            { value: 'relative', label: 'Relative' },
          ]}
        />
      </SettingRow>

      {/* Reset */}
      <div style={{ padding: 16 }}>
        <button
          onClick={resetToDefaults}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            padding: '8px 12px', background: 'var(--bg-emphasis)',
            border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-ui)', cursor: 'pointer',
            justifyContent: 'center',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-emphasis)'; }}
        >
          <RotateCcw size={12} />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default Settings;
