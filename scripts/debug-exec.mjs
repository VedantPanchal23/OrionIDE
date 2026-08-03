/**
 * Debug one execution through execution-service.
 */
const headers = { 'Content-Type': 'application/json', 'X-User-Id': 'live-test-user' };

async function main() {
  const r = await fetch('http://localhost:3004/execute', {
    method: 'POST',
    headers,
    body: JSON.stringify({ languageId: 'python', fileName: 't.py', code: 'print("hi")\n' }),
  });
  const j = await r.json();
  console.log('submit', r.status, JSON.stringify(j));
  const id = j.data.executionId || j.data.id;

  for (let i = 0; i < 20; i++) {
    await new Promise((res) => setTimeout(res, 400));
    const rr = await fetch(`http://localhost:3004/execute/${id}/result`, {
      headers: { 'X-User-Id': 'live-test-user' },
    });
    const jj = await rr.json();
    console.log(i, rr.status, jj?.data?.status, JSON.stringify(jj?.data?.stdout), jj?.data?.exitCode);
    if (jj?.data?.status === 'completed' || jj?.data?.status === 'failed') break;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
