/**
 * Orion IDE — Settings panel (editor + appearance preferences)
 */

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { PanelHeader, Switch, Button } from '../ui/primitives';

export default function SettingsPanel() {
  const {
    theme, toggleTheme, editorFontSize, setEditorFontSize,
    tabSize, setTabSize, wordWrap, setWordWrap, minimap, setMinimap,
    lineNumbers, setLineNumbers,
  } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <PanelHeader title="Settings" />
      <div className="settings-body">
        <div className="settings-section">
          <h3>Appearance</h3>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Theme</strong>
              <span>Switch between dark and light chrome</span>
            </div>
            <div className="settings-row-control">
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{theme}</span>
              <Switch checked={theme === 'light'} onChange={toggleTheme} label="Toggle theme" />
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Editor</h3>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Font size</strong>
              <span>Monaco editor text size</span>
            </div>
            <div className="settings-row-control">
              <input
                type="range"
                className="o-range"
                min={11}
                max={20}
                value={editorFontSize}
                onChange={(e) => setEditorFontSize(Number(e.target.value))}
              />
              <span className="o-mono" style={{ width: 28, textAlign: 'right' }}>{editorFontSize}</span>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Tab size</strong>
              <span>Spaces per indent level</span>
            </div>
            <div className="settings-row-control">
              <select className="o-select" value={tabSize} onChange={(e) => setTabSize(Number(e.target.value))}>
                {[2, 4, 8].map((n) => <option key={n} value={n}>{n} spaces</option>)}
              </select>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Word wrap</strong>
              <span>Wrap long lines instead of scrolling</span>
            </div>
            <Switch checked={wordWrap} onChange={setWordWrap} label="Toggle word wrap" />
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Minimap</strong>
              <span>Show the code overview on the right</span>
            </div>
            <Switch checked={minimap} onChange={setMinimap} label="Toggle minimap" />
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>Line numbers</strong>
              <span>Show gutter line numbers</span>
            </div>
            <Switch checked={lineNumbers} onChange={setLineNumbers} label="Toggle line numbers" />
          </div>
        </div>

        <div className="settings-section">
          <h3>Account</h3>
          <div className="settings-row">
            <div className="settings-row-label">
              <strong>{user?.name || 'Signed in'}</strong>
              <span>{user?.email}</span>
            </div>
            <Button variant="subtle" onClick={logout}>Sign out</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
