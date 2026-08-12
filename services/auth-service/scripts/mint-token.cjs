const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const root = path.resolve(__dirname, '../../..');
const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
const secret = (env.match(/^JWT_SECRET=(.+)$/m) || [])[1]
  ?.trim()
  .replace(/^["']|["']$/g, '');

if (!secret) {
  console.error('JWT_SECRET missing');
  process.exit(1);
}

const token = jwt.sign(
  {
    userId: process.env.USER_ID || '115924791191040046338',
    email: process.env.USER_EMAIL || 'vedantwork1402@gmail.com',
    name: process.env.USER_NAME || 'Vedant Panchal',
    picture: null,
    jti: uuidv4(),
    type: 'access',
  },
  secret,
  { expiresIn: process.env.EXPIRES_IN || '2h' },
);

process.stdout.write(token);
