import { lazy, Suspense } from 'react';
import { Columns2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useEditor } from '../../context/EditorContext';
import EditorTabs from './EditorTabs';
import Breadcrumbs from './Breadcrumbs';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { fileUri } from '../../editor/lsp/monacoLsp';
import { BrandMark, IconButton, Spinner } from '../ui/primitives';
import { modKey } from '../../utils/platform';
import NotebookEditor from '../notebook/NotebookEditor';

const MonacoEditor = lazy(() => import('./MonacoEditor'));

function isNotebook(file) {
  return /\.ipynb$/i.test(file?.name || '');
}

function EditorSurface({
  file, projectId, pane, focused, onFocus, themeOpts, onChange, onCursor, onSave, onRegister, revealRequest, onRevealHandled, pauseLine, relativePath,
}) {
  if (!file) {
    return (
      <div className={`editor-pane-slot ${focused ? 'focused' : ''}`} onClick={onFocus} role="presentation">
        <div className="editor-empty compact">
          <span className="muted">No file in this pane</span>
        </div>
      </div>
    );
  }
  if (file.loading) {
    return (
      <div className={`editor-pane-slot ${focused ? 'focused' : ''}`} onClick={onFocus} role="presentation">
        <div className="editor-empty compact"><Spinner /><span>Loading…</span></div>
      </div>
    );
  }

  if (isNotebook(file)) {
    return (
      <div className={`editor-pane-slot ${focused ? 'focused' : ''}`} onClick={onFocus} role="presentation">
        <div className="editor-surface notebook-surface">
          <NotebookEditor
            key={`${pane}-${file.id}`}
            file={file}
            onChange={(value) => onChange(file.id, value)}
            onSaveShortcut={() => onSave(file.id)}
            onRegisterLiveContent={onRegister}
            onFocus={onFocus}
          />
        </div>
      </div>
    );
  }

  const modelPath = fileUri(projectId, relativePath || file.name);
  return (
    <div className={`editor-pane-slot ${focused ? 'focused' : ''}`} onClick={onFocus} role="presentation">
      <div className="editor-surface">
        <Suspense fallback={<div className="editor-loading"><Spinner /><span>Loading editor…</span></div>}>
          <MonacoEditor
            key={`${pane}-${file.id}`}
            file={file}
            modelPath={modelPath}
            relativePath={relativePath || file.name}
            projectId={projectId}
            themeMode={themeOpts.theme}
            fontSize={themeOpts.editorFontSize}
            tabSize={themeOpts.tabSize}
            wordWrap={themeOpts.wordWrap}
            minimap={themeOpts.minimap}
            lineNumbers={themeOpts.lineNumbers}
            stickyScroll={themeOpts.stickyScroll}
            formatOnSave={themeOpts.formatOnSave}
            onChange={(value) => onChange(file.id, value)}
            onCursorChange={onCursor}
            onSaveShortcut={() => onSave(file.id)}
            onRegisterLiveContent={onRegister}
            revealRequest={revealRequest}
            onRevealHandled={onRevealHandled}
            onFocus={onFocus}
            pauseLine={pauseLine}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default function EditorPane({ projectId }) {
  const {
    activeFile, secondaryFile, focusedFile, focusedPane, setFocusedPane,
    split, toggleSplit, updateContent, saveFile, setCursorPosition,
    registerLiveContent, revealRequest, clearReveal, openFiles, pauseLine,
  } = useEditor();
  const themeOpts = useTheme();
  const tree = useFileTreeContext();
  const mod = modKey();

  const relPathFor = (file) => {
    if (!file?.id) return file?.name || 'untitled';
    try {
      const parts = (tree.getPath(file.id) || []).map((n) => n.name);
      // Drop project root folder name — LSP root is the project folder itself
      return parts.length > 1 ? parts.slice(1).join('/') : (file.name || parts[0] || 'untitled');
    } catch {
      return file.name || 'untitled';
    }
  };

  const hasFiles = openFiles.length > 0;
  const primary = activeFile;
  const secondary = secondaryFile || (split ? activeFile : null);

  return (
    <div className="ide-main">
      {hasFiles && (
        <>
          <div className="editor-chrome-row">
            <EditorTabs />
            <IconButton
              title={split ? 'Close Split Editor' : 'Split Editor Right'}
              className={split ? 'active' : ''}
              onClick={toggleSplit}
            >
              <Columns2 size={14} />
            </IconButton>
          </div>
          <Breadcrumbs file={focusedFile} />
        </>
      )}
      {!hasFiles ? (
        <div className="editor-empty">
          <BrandMark size={40} />
          <h2>Orion IDE</h2>
          <p>
            Open a file from the Explorer, or press
            {' '}
            <kbd>{mod}</kbd>
            +
            <kbd>P</kbd>
            {' '}
            to Quick Open.
          </p>
          <ul className="empty-hints">
            <li>
              <kbd>{mod}</kbd>
              +
              <kbd>Shift</kbd>
              +
              <kbd>P</kbd>
              {' '}
              Command Palette
            </li>
            <li>
              <kbd>{mod}</kbd>
              +
              <kbd>S</kbd>
              {' '}
              Save ·
              {' '}
              <kbd>{mod}</kbd>
              +
              <kbd>Enter</kbd>
              {' '}
              Run
            </li>
            <li>
              <kbd>{mod}</kbd>
              +
              <kbd>`</kbd>
              {' '}
              Toggle Terminal
            </li>
          </ul>
        </div>
      ) : (
        <div className={`editor-canvas ${split ? 'split' : ''}`}>
          <EditorSurface
            file={primary}
            projectId={projectId}
            pane="primary"
            focused={focusedPane === 'primary'}
            onFocus={() => setFocusedPane('primary')}
            themeOpts={themeOpts}
            onChange={updateContent}
            onCursor={setCursorPosition}
            onSave={saveFile}
            onRegister={registerLiveContent}
            revealRequest={revealRequest}
            onRevealHandled={clearReveal}
            pauseLine={pauseLine}
            relativePath={relPathFor(primary)}
          />
          {split && (
            <EditorSurface
              file={secondary}
              projectId={projectId}
              pane="secondary"
              focused={focusedPane === 'secondary'}
              onFocus={() => setFocusedPane('secondary')}
              themeOpts={themeOpts}
              onChange={updateContent}
              onCursor={setCursorPosition}
              onSave={saveFile}
              onRegister={registerLiveContent}
              revealRequest={revealRequest}
              onRevealHandled={clearReveal}
              pauseLine={pauseLine}
              relativePath={relPathFor(secondary)}
            />
          )}
        </div>
      )}
    </div>
  );
}
