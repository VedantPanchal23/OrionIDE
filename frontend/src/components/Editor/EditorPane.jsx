/**
 * Orion IDE — editor pane: tabs + Monaco surface
 */

import { useCallback } from 'react';
import { FileCode2 } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import EditorTabs from './EditorTabs';
import MonacoEditor from './MonacoEditor';
import { Spinner, Kbd } from '../ui/primitives';

export default function EditorPane() {
  const {
    activeFile, updateContent, saveFile, setCursorPosition,
    registerReveal, pendingReveal, consumeReveal,
  } = useEditor();
  const {
    theme, editorFontSize, tabSize, wordWrap, minimap, lineNumbers,
  } = useTheme();
  const toast = useToast();

  const handleSave = useCallback((id) => {
    saveFile(id).then(() => {
      toast.success('Saved to Drive');
    }).catch((err) => {
      toast.error(err?.response?.data?.error?.message || err.message || 'Save failed');
    });
  }, [saveFile, toast]);

  return (
    <div className="ide-main">
      <EditorTabs />
      {!activeFile ? (
        <div className="editor-empty">
          <FileCode2 size={40} strokeWidth={1.3} />
          <h2>Nothing open yet</h2>
          <div className="editor-empty-hints">
            <div><span>Save file</span><Kbd>Ctrl S</Kbd></div>
            <div><span>Command palette</span><Kbd>Ctrl K</Kbd></div>
            <div><span>New file</span><Kbd>Ctrl N</Kbd></div>
          </div>
        </div>
      ) : activeFile.loading ? (
        <div className="editor-empty"><Spinner /></div>
      ) : (
        <div className="editor-canvas">
          <div className="editor-surface">
            <MonacoEditor
              key={activeFile.id}
              file={activeFile}
              themeMode={theme}
              fontSize={editorFontSize}
              tabSize={tabSize}
              wordWrap={wordWrap}
              minimap={minimap}
              lineNumbers={lineNumbers}
              onChange={(value) => updateContent(activeFile.id, value)}
              onCursorChange={setCursorPosition}
              onSaveShortcut={() => handleSave(activeFile.id)}
              onRegisterReveal={(fn) => registerReveal(activeFile.id, fn)}
              pendingRevealLine={pendingReveal?.fileId === activeFile.id ? pendingReveal.line : null}
              onConsumeReveal={() => consumeReveal(activeFile.id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
