/**
 * Golden-path smoke: login identity → Drive → save → execute → terminal.
 * Same requirements as e2e-full.mjs — real Google JWT.
 *
 * Exit 0 on full pass. Designed for CI when ORION_ACCESS_TOKEN secret is set.
 * Locally: `node scripts/mint-access-token.mjs` then set ORION_ACCESS_TOKEN.
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.ORION_ACCESS_TOKEN) {
  console.log('SKIP smoke-happy-path: ORION_ACCESS_TOKEN not set');
  process.exit(0);
}

const script = path.join(__dirname, 'e2e-full.mjs');
const result = spawnSync(process.execPath, [script], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
