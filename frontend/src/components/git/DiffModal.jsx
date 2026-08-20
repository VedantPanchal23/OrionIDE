import { lazy, Suspense } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getMonacoLanguage } from '../../utils/languageMap';
import { Spinner } from '../ui/primitives';
import { MONO_FONT, monacoThemeDef } from '../../theme/workbench';

const DiffEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor })),
);

export default function DiffModal({ open, title, original, modified, path, onClose }) {
  const theme = useTheme();

  if (!open) return null;

  const language = getMonacoLanguage(path || title || '');
  const monacoTheme = theme.theme === 'light' ? 'orion-light' : 'orion-dark';

  return (
    <div className="diff-modal-root" role="dialog" aria-modal="true" aria-label="Diff">
      <button type="button" className="diff-modal-backdrop" aria-label="Close diff" onClick={onClose} />
      <div className="diff-modal">
        <header className="diff-modal-head">
          <div>
            <strong>{title || path || 'Diff'}</strong>
            <span className="muted"> HEAD → working tree</span>
          </div>
          <button type="button" className="icon-btn" title="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="diff-modal-body">
          <Suspense fallback={<div className="editor-loading"><Spinner /><span>Loading diff…</span></div>}>
            <DiffEditor
              height="100%"
              language={language}
              theme={monacoTheme}
              original={original ?? ''}
              modified={modified ?? ''}
              beforeMount={(monaco) => {
                monaco.editor.defineTheme('orion-dark', monacoThemeDef('dark'));
                monaco.editor.defineTheme('orion-light', monacoThemeDef('light'));
              }}
              options={{
                readOnly: true,
                renderSideBySide: true,
                fontSize: theme.editorFontSize,
                fontFamily: MONO_FONT,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
