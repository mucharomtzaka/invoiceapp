const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const electronCli = path.join(root, 'node_modules', 'electron', 'cli.js');
const next = spawn(process.execPath, [nextCli, 'dev'], { cwd: root, stdio: 'inherit' });
let electron;
let stopped = false;

async function waitForNext() {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (next.exitCode !== null) throw new Error('Next.js berhenti sebelum server siap.');
    try {
      await fetch('http://127.0.0.1:3000');
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Waktu tunggu server Next.js habis.');
}

function stop() {
  if (stopped) return;
  stopped = true;
  next.kill('SIGTERM');
  electron?.kill('SIGTERM');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

waitForNext().then(() => {
  electron = spawn(process.execPath, [electronCli, '.'], { cwd: root, stdio: 'inherit' });
  electron.on('exit', code => { stop(); process.exitCode = code || 0; });
}).catch(error => {
  console.error(error.message);
  stop();
  process.exitCode = 1;
});
