/**
 * Agent pipeline smoke — starts a tiny goal and waits for first step / approve gate.
 * Uses server-side GROQ/OPENROUTER keys (no BYOK required).
 *
 *   $env:ORION_ACCESS_TOKEN=(node scripts/mint-access-token.mjs --print)
 *   node scripts/smoke-agent.mjs
 */
const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
const TOKEN = process.env.ORION_ACCESS_TOKEN;
const GOAL = process.env.AGENT_GOAL
  || 'Create a single Python file hello.py that prints Hello Orion and nothing else.';

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
    const projectId = projects.json.data.projects?.[0]?.id;
    assert(projectId, 'need a Drive project');
    log('drive.project', true, projectId);

    const start = await api('POST', '/agents/pipeline/start', {
      goal: GOAL,
      projectFolderId: projectId,
      projectName: 'agent-smoke',
    });
    assert(start.status === 201 || start.status === 200, `start ${start.status} ${JSON.stringify(start.json)}`);
    const sessionId = start.json.data.sessionId;
    log('agent.start', true, sessionId);

    let session = start.json.data.session;
    const deadline = Date.now() + (Number(process.env.AGENT_SMOKE_TIMEOUT_MS) || 180000);
    let approved = 0;
    while (Date.now() < deadline) {
      let get;
      for (let attempt = 0; attempt < 8; attempt++) {
        get = await api('GET', `/agents/pipeline/${sessionId}`);
        if (get.status !== 429) break;
        const retryAfter = Number(get.json?.error?.details?.retryAfter || 5);
        const waitMs = Math.max(1000, Math.min(30000, (retryAfter + 1) * 1000));
        console.log(`  … rate limited, waiting ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
      assert(get.status === 200, `get ${get.status} ${JSON.stringify(get.json)}`);
      session = get.json.data;
      const status = session.status || session.state;
      const step = session.currentStep ?? session.step;
      console.log(`  … status=${status} step=${step}`);

      if (['completed', 'complete'].includes(String(status))) break;
      if (['failed', 'error', 'rejected'].includes(String(status))) {
        throw new Error(`pipeline ${status}: ${JSON.stringify(session.runAgent?.result || session.error || {})}`);
      }
      if (String(status).includes('approv')) {
        const approve = await api('POST', `/agents/pipeline/${sessionId}/approve`, { step });
        assert(approve.status === 200, `approve ${approve.status} ${JSON.stringify(approve.json)}`);
        approved += 1;
        console.log(`  … approved step=${step} (n=${approved})`);
        await new Promise((r) => setTimeout(r, 1500));
      }
      await new Promise((r) => setTimeout(r, 5000));
    }

    assert(['completed', 'complete'].includes(session.status) || approved > 0, 'no progress');
    log('agent.progress', true, `status=${session.status} step=${session.currentStep} approvals=${approved}`);
    log('agent.files', Array.isArray(session.fileAgent?.written), `written=${session.fileAgent?.written?.length || 0}`);
    if (['completed', 'complete'].includes(session.status)) {
      log('agent.completed', true, JSON.stringify(session.runAgent?.result || {}).slice(0, 160));
    } else {
      log('agent.completed', false, `stopped at ${session.status}`);
    }

    console.log('\n========== SUMMARY ==========');
    console.log(`passed=${steps.filter((s) => s.ok).length} failed=${steps.filter((s) => !s.ok).length}`);
    console.log('SMOKE_AGENT_PASS');
    console.log(`SESSION=${sessionId}`);
  } catch (err) {
    console.error('\nFAIL', err.message);
    console.log('SMOKE_AGENT_FAIL');
    process.exit(1);
  }
}

main();
