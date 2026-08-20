import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useFileTreeContext } from '../../context/FileTreeContext';
import { FileIcon, FolderIcon } from '../../utils/fileIcons';

export default function Breadcrumbs({ file: fileProp }) {
  const { activeFile, focusedFile, openFile } = useEditor();
  const tree = useFileTreeContext();
  const file = fileProp || focusedFile || activeFile;

  const crumbs = useMemo(() => {
    if (!file) return [];
    return tree.getPath(file.id);
  }, [file, tree]);

  if (!file || crumbs.length === 0) {
    return <div className="breadcrumbs muted">No file open</div>;
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((node, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={node.id} className="crumb">
            {i > 0 && <ChevronRight size={12} className="crumb-sep" />}
            {node.isFolder ? <FolderIcon open size={12} /> : <FileIcon name={node.name} size={12} />}
            <button
              type="button"
              className={`crumb-btn ${last ? 'current' : ''}`}
              disabled={last && !node.isFolder}
              onClick={() => {
                if (node.isFolder) {
                  tree.revealInTree(node.id);
                  if (!tree.expandedIds.has(node.id)) tree.toggleExpand(node.id);
                } else {
                  openFile(node);
                }
              }}
            >
              {node.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
