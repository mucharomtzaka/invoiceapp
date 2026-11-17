const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'desktop', 'assets');
const database = path.join(assets, 'initial.db');
fs.mkdirSync(assets, { recursive: true });
fs.rmSync(database, { force: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['exec', 'prisma', '--', 'db', 'push'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: pathToDatabaseUrl(database) },
});
if (result.status !== 0) process.exit(result.status || 1);
if (!fs.existsSync(database)) throw new Error('Database template SQLite tidak terbentuk.');

function pathToDatabaseUrl(file) {
  return `file:${file.replaceAll('\\', '/')}`;
}
