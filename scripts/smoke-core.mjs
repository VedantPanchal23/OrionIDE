/**
 * Smoke test: real Google auth token → projects → create file → execute
 *
 *   $env:ORION_ACCESS_TOKEN="<jwt>"
 *   node scripts/smoke-core.mjs
 */
const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
const TOKEN = process.env.ORION_ACCESS_TOKEN;

async function main() {
  if (!TOKEN) {
    throw new Error('Set ORION_ACCESS_TOKEN from a real Google login (mocks removed)');
  }
  const payload = JSON.parse(Buffer.from(TOKEN.split('.')[1], 'base64url').toString());
  if (payload.userId === 'dev-user-123') throw new Error('dev-login tokens are not accepted');
  console.log('OK auth');

  const h = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };

  const projectsRes = await fetch(`${GATEWAY}/api/drive/projects`, { headers: h });
  const projectsBody = await projectsRes.json();
  if (!projectsRes.ok) throw new Error(`projects: ${JSON.stringify(projectsBody)}`);
  console.log('OK projects', {
    count: projectsBody?.data?.projects?.length,
    root: projectsBody?.data?.rootFolderId,
  });

  const root = projectsBody.data.rootFolderId;
  let projectId = projectsBody.data.projects?.[0]?.id;
  if (!projectId) {
    const created = await fetch(`${GATEWAY}/api/drive/files`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ parentFolderId: root, name: 'Smoke Project', type: 'folder' }),
    }).then((r) => r.json());
    projectId = created?.data?.id;
    if (!projectId) throw new Error(`create project failed: ${JSON.stringify(created)}`);
    console.log('OK create project', projectId);
  }

  const file = await fetch(`${GATEWAY}/api/drive/files`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      parentFolderId: projectId,
      name: `smoke_${Date.now()}.py`,
      type: 'file',
      content: 'print("smoke")\n',
    }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  if (file.status >= 400) throw new Error(`create file: ${JSON.stringify(file.body)}`);
  console.log('OK create file', file.body.data.id);

  const exec = await fetch(`${GATEWAY}/api/execute`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      languageId: 'python',
      fileName: 'smoke.py',
      code: 'print("smoke")\n',
    }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  if (exec.status >= 400) throw new Error(`execute: ${JSON.stringify(exec.body)}`);
  console.log('OK execute', exec.body.data.executionId || exec.body.data.id);
  console.log('SMOKE_PASS');
}

main().catch((err) => {
  console.error('SMOKE_FAIL', err.message);
  process.exit(1);
});
