/**
 * Parse VS Code–style launch.json / tasks-like debug configs.
 */

export function normalizeLaunchConfigs(raw) {
  const list = Array.isArray(raw?.configurations)
    ? raw.configurations
    : Array.isArray(raw) ? raw : [];
  return list
    .map((c, i) => {
      if (!c || typeof c !== 'object') return null;
      const name = c.name || c.label || `Config ${i + 1}`;
      const type = String(c.type || '').toLowerCase();
      let adapter = null;
      if (type.includes('python') || type === 'debugpy') adapter = 'python';
      else if (type.includes('node') || type === 'pwa-node' || type === 'chrome') adapter = 'node';
      else if (type) adapter = type;
      const program = c.program || c.main || c.file || '';
      return {
        name: String(name),
        adapter,
        request: c.request || 'launch',
        program: String(program).replace(/\$\{workspaceFolder\}\/?/g, '').replace(/^\.\//, ''),
        args: Array.isArray(c.args) ? c.args.map(String) : [],
        cwd: c.cwd ? String(c.cwd).replace(/\$\{workspaceFolder\}\/?/g, '') : '',
        stopOnEntry: c.stopOnEntry !== false,
        raw: c,
      };
    })
    .filter((c) => c && c.adapter && c.program)
    .slice(0, 30);
}

export function findLaunchNode(tree) {
  const files = tree.listFilesFlat?.() || [];
  const prefer = [
    (f) => f.name === 'launch.json' && (tree.getPath?.(f.id) || []).some((n) => n.name === '.vscode' || n.name === '.orion'),
    (f) => f.name === 'launch.json',
  ];
  for (const pred of prefer) {
    const hit = files.find(pred);
    if (hit) return hit;
  }
  return null;
}
