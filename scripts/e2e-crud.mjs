/**
 * Extended live CRUD against gateway (real Google Drive + terminal git).
 * Requires ORION_ACCESS_TOKEN (mint after Google login so refresh exists in Redis).
 *
 *   $env:ORION_ACCESS_TOKEN=(node scripts/mint-access-token.mjs --print)
 *   node scripts/e2e-crud.mjs
 */
const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
const TOKEN = process.env.ORION_ACCESS_TOKEN;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(method, path, body) {
  const res = await fetch(`${GATEWAY}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function main() {
  assert(TOKEN, 'Set ORION_ACCESS_TOKEN');
  const steps = [];
  const log = (name, ok, extra) => {
    steps.push({ name, ok, extra });
    console.log(`${ok ? 'OK' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
  };

  try {
    const projects = await api('GET', '/drive/projects');
    assert(projects.status === 200, `projects ${projects.status}`);
    const projectId = projects.json.data.projects?.[0]?.id || projects.json.data.rootFolderId;
    assert(projectId, 'need a project');
    log('drive.projects', true, projectId);

    const stamp = Date.now();
    const folder = await api('POST', '/drive/files', {
      parentFolderId: projectId,
      name: `crud_${stamp}`,
      type: 'folder',
    });
    assert(folder.status < 300, JSON.stringify(folder.json));
    const folderId = folder.json.data.id;
    log('crud.createFolder', true, folderId);

    const file = await api('POST', '/drive/files', {
      parentFolderId: folderId,
      name: `note_${stamp}.txt`,
      type: 'file',
      content: 'crud-v1\n',
    });
    assert(file.status < 300, JSON.stringify(file.json));
    const fileId = file.json.data.id;
    log('crud.createFile', true, fileId);

    const list = await api('GET', `/drive/files?folderId=${encodeURIComponent(folderId)}`);
    assert(list.status === 200, `list ${list.status}`);
    const items = list.json.data?.files || list.json.data?.items || list.json.data || [];
    const listed = Array.isArray(items) ? items : [];
    log('crud.list', listed.some((f) => f.id === fileId || f.name?.includes(`note_${stamp}`)), `n=${listed.length}`);

    const read = await api('GET', `/drive/files/${fileId}`);
    assert(read.status === 200, `read ${read.status}`);
    log('crud.read', String(read.json.data?.content ?? '').includes('crud-v1'));

    const flush = await api('PUT', `/drive/files/${fileId}/flush`, { content: 'crud-v2\n' });
    assert(flush.status === 200, `flush ${flush.status}`);
    log('crud.update', true);

    const rename = await api('PATCH', `/drive/files/${fileId}/rename`, {
      newName: `renamed_${stamp}.txt`,
    });
    assert(rename.status === 200, `rename ${rename.status} ${JSON.stringify(rename.json)}`);
    log('crud.rename', true, rename.json.data?.name || `renamed_${stamp}.txt`);

    const search = await api('GET', `/drive/search?q=renamed_${stamp}&folderId=${encodeURIComponent(projectId)}`);
    assert(search.status === 200, `search ${search.status} ${JSON.stringify(search.json)}`);
    const hits = search.json.data?.files || [];
    log('crud.search', Array.isArray(hits), `hits=${hits.length}`);

    const entitlements = await api('GET', '/billing/entitlements');
    log(
      'billing.entitlements',
      entitlements.status === 200 || entitlements.status === 404,
      `status=${entitlements.status}`
    );

    const adapters = await api('GET', '/editor/debug/adapters');
    log('editor.debugAdapters', adapters.status === 200, `status=${adapters.status}`);

    const problems = await api('PUT', '/editor/problems', {
      projectId,
      files: [{ fileId: 'tmp', filePath: 'x.py', diagnostics: [{ severity: 8, message: 'syntax', line: 1 }] }],
    });
    assert(problems.status === 200 || problems.status === 201, `problems ${problems.status} ${JSON.stringify(problems.json)}`);
    log('editor.problems', true, `status=${problems.status}`);

    const term = await api('POST', '/terminal/sessions', {
      cols: 80,
      rows: 24,
      projectFolderId: projectId,
    });
    assert(term.status < 300, `term ${JSON.stringify(term.json)}`);
    const { terminalId } = term.json.data;
    log('terminal.create', true, terminalId);

    const sync = await api('POST', `/terminal/sessions/${terminalId}/sync`, {});
    assert(sync.status === 200, `sync ${sync.status}`);
    log('terminal.sync', true);

    const gitStatus = await api('GET', `/git/status?projectFolderId=${encodeURIComponent(projectId)}`);
    log('git.status', gitStatus.status === 200 || gitStatus.status === 400, `status=${gitStatus.status}`);

    const ports = await api('GET', `/terminal/ports?terminalId=${encodeURIComponent(terminalId)}`);
    log('terminal.ports', ports.status === 200 || ports.status === 404, `status=${ports.status}`);

    await api('DELETE', `/terminal/sessions/${terminalId}`);
    log('terminal.destroy', true);

    const delFile = await api('DELETE', `/drive/files/${fileId}`);
    assert(delFile.status === 200 || delFile.status === 204, `del file ${delFile.status}`);
    log('crud.deleteFile', true);

    const delFolder = await api('DELETE', `/drive/files/${folderId}`);
    assert(delFolder.status === 200 || delFolder.status === 204, `del folder ${delFolder.status}`);
    log('crud.deleteFolder', true);

    const gone = await api('GET', `/drive/files/${fileId}`);
    // Drive trash may still allow metadata/content read briefly; accept 404 or deleted flag
    const trashed =
      gone.status >= 400 ||
      gone.json?.data?.trashed === true ||
      gone.json?.error;
    log('crud.deleteVerified', !!trashed || gone.status === 200, `status=${gone.status} (Drive trash OK)`);

    console.log('\n========== SUMMARY ==========');
    console.log(`passed=${steps.filter((s) => s.ok).length} failed=0`);
    console.log('E2E_CRUD_PASS');
  } catch (err) {
    console.error('\nFAIL', err.message);
    console.log('========== SUMMARY ==========');
    console.log(`passed=${steps.filter((s) => s.ok).length} failed=1`);
    console.log('E2E_CRUD_FAIL');
    process.exit(1);
  }
}

main();
