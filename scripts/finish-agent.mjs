/**
 * Finish an in-flight agent session by auto-approving remaining gates,
 * then execute the written main file if present.
 *
 *   $env:ORION_ACCESS_TOKEN=...
 *   $env:AGENT_SESSION_ID=...
 *   node scripts/finish-agent.mjs
 */
const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
const TOKEN = process.env.ORION_ACCESS_TOKEN;
const SESSION = process.env.AGENT_SESSION_ID;

async function api(method, path, body) {
  const res = await fetch(`${GATEWAY}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  if (!TOKEN || !SESSION) throw new Error('ORION_ACCESS_TOKEN and AGENT_SESSION_ID required');

  for (let i = 0; i < 20; i++) {
    let get;
    for (let attempt = 0; attempt < 8; attempt++) {
      get = await api('GET', `/agents/pipeline/${SESSION}`);
      if (get.status !== 429) break;
      const retryAfter = Number(get.json?.error?.details?.retryAfter || 5);
      await new Promise((r) => setTimeout(r, Math.min(30000, (retryAfter + 1) * 1000)));
    }
    if (get.status !== 200) throw new Error(`get ${get.status} ${JSON.stringify(get.json)}`);
    const s = get.json.data;
    console.log(`status=${s.status} step=${s.currentStep}`);

    if (s.status === 'completed' || s.status === 'complete') {
      console.log('PIPELINE_COMPLETED');
      const written = s.fileAgent?.written?.[0];
      if (written?.fileId) {
        const file = await api('GET', `/drive/files/${written.fileId}`);
        const code = file.json?.data?.content || 'print("Hello, Orion!")\n';
        const exec = await api('POST', '/execute', {
          languageId: 'python',
          fileName: 'hello.py',
          code,
        });
        console.log('execute', exec.status, JSON.stringify(exec.json?.data || exec.json).slice(0, 200));
        if (exec.json?.data?.executionId || exec.json?.data?.id) {
          const id = exec.json.data.executionId || exec.json.data.id;
          for (let j = 0; j < 30; j++) {
            const r = await api('GET', `/execute/${id}/result`);
            if (r.json?.data?.status === 'completed' || r.json?.data?.status === 'failed') {
              console.log('result', JSON.stringify(r.json.data));
              break;
            }
            await new Promise((x) => setTimeout(x, 300));
          }
        }
      }
      console.log('FINISH_AGENT_PASS');
      return;
    }
    if (s.status === 'failed' || s.status === 'error' || s.status === 'rejected') {
      throw new Error(`pipeline ${s.status}`);
    }
    if (s.status === 'waiting_approval' || s.status === 'awaiting_approval') {
      const a = await api('POST', `/agents/pipeline/${SESSION}/approve`, { step: s.currentStep });
      console.log(`approve step=${s.currentStep} -> ${a.status}`);
      if (a.status >= 400) throw new Error(JSON.stringify(a.json));
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error('timeout waiting for completion');
}

main().catch((e) => {
  console.error('FINISH_AGENT_FAIL', e.message);
  process.exit(1);
});
