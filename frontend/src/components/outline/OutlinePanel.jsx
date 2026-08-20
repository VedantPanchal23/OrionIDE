import { useEffect, useState } from 'react';
import { ListTree } from 'lucide-react';
import { subscribeOutline } from '../../editor/lsp/monacoLsp';

const KIND_LABEL = {
  1: 'file', 2: 'mod', 5: 'class', 6: 'method', 11: 'fn', 12: 'var',
  13: 'const', 14: 'str',
};

function flatten(symbols, depth = 0, out = []) {
  (symbols || []).forEach((s) => {
    out.push({ ...s, depth });
    if (s.children?.length) flatten(s.children, depth + 1, out);
  });
  return out;
}

export default function OutlinePanel({ onReveal }) {
  const [symbols, setSymbols] = useState([]);
  const [uri, setUri] = useState('');

  useEffect(() => subscribeOutline(({ symbols: next, uri: u }) => {
    setSymbols(Array.isArray(next) ? next : []);
    setUri(u || '');
  }), []);

  const rows = flatten(symbols);

  return (
    <div className="side-panel outline-panel">
      <div className="ide-sidebar-title">
        <span>Outline</span>
        <ListTree size={14} />
      </div>
      {!rows.length ? (
        <div className="side-empty muted">
          Open a file — symbols appear when the language server is ready.
        </div>
      ) : (
        <ul className="outline-list">
          {rows.map((s, i) => (
            <li key={`${s.name}-${i}`}>
              <button
                type="button"
                className="outline-row"
                style={{ paddingLeft: 8 + (s.depth || 0) * 12 }}
                title={uri}
                onClick={() => {
                  const line = s.selectionRange?.startLineNumber || s.range?.startLineNumber;
                  if (line) onReveal?.(line, s.selectionRange?.startColumn || 1);
                }}
              >
                <span className="outline-kind">{KIND_LABEL[s.kind] || 'sym'}</span>
                <span className="outline-name">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
