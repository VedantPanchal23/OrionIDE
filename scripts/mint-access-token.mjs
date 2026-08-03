/**
 * Mint a short-lived Orion access JWT for local smoke / debugging.
 *
 * Uses JWT_SECRET from root .env (same as auth-service). Does NOT create
 * Google tokens — those must already exist in Redis (login once via UI).
 *
 * Usage:
 *   node scripts/mint-access-token.mjs
 *   $env:ORION_ACCESS_TOKEN=(node scripts/mint-access-token.mjs --print)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const require = createRequire(path.join(root, 'services/auth-service/package.json'));
const jwt = require('jsonwebtoken');

const loadEnv = () => {
  const envPath = path.join(root, '.env');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
};

const env = { ...loadEnv(), ...process.env };
const secret = env.JWT_SECRET;
if (!secret) {
  console.error('JWT_SECRET missing in .env');
  process.exit(1);
}

const userId = process.env.ORION_USER_ID || '115924791191040046338';
const email = process.env.ORION_USER_EMAIL || 'vedantwork1402@gmail.com';
const name = process.env.ORION_USER_NAME || 'Vedant Panchal';
const picture = process.env.ORION_USER_PICTURE || null;
const expiry = env.JWT_ACCESS_EXPIRY || '15m';

const token = jwt.sign(
  {
    userId,
    email,
    name,
    picture,
    jti: crypto.randomUUID(),
    type: 'access',
  },
  secret,
  { expiresIn: expiry },
);

if (process.argv.includes('--print') || process.argv.includes('-p')) {
  process.stdout.write(token);
} else {
  console.log(token);
  console.log('\n# PowerShell:');
  console.log(`$env:ORION_ACCESS_TOKEN='${token}'`);
  console.log('node scripts/smoke-happy-path.mjs');
}
