require('dotenv').config();

const { spawn } = require('node:child_process');

const port = Number(process.env.PORT || 3000);
const hostname = process.env.APP_HOST || '0.0.0.0';

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT harus berupa angka antara 1 dan 65535.');
}

const nextCli = require.resolve('next/dist/bin/next');
const server = spawn(process.execPath, [
  nextCli,
  'start',
  '--hostname', hostname,
  '--port', String(port),
], { stdio: 'inherit', env: process.env });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}

server.on('error', error => {
  console.error('Next.js gagal dijalankan:', error);
  process.exitCode = 1;
});
server.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
