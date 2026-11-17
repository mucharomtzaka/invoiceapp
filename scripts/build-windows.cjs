const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'invoiceapp-win-build-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = { ...process.env, npm_config_cache: path.join(temp, 'npm-cache') };
const nativeBinary = path.join(root, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
const nativeBackup = path.join(temp, 'better_sqlite3.host.node');
const lockFile = path.join(root, '.desktop-build.lock');
let lockFd;
let hasNativeBackup = false;

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} gagal (exit ${result.status ?? 'signal'}).`);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Two builds writing release/win-unpacked at the same time corrupt the NSIS
// payload and produce misleading 7-Zip "No such file or directory" warnings.
function acquireLock() {
  if (fs.existsSync(lockFile)) {
    const pid = Number(fs.readFileSync(lockFile, 'utf8').trim());
    if (pid && isProcessAlive(pid)) {
      throw new Error(`Build desktop lain masih berjalan (PID ${pid}). Tunggu hingga selesai, lalu jalankan ulang.`);
    }
    fs.rmSync(lockFile, { force: true });
  }
  try {
    lockFd = fs.openSync(lockFile, 'wx');
    fs.writeSync(lockFd, String(process.pid));
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error('Build desktop lain baru saja dimulai. Tunggu hingga selesai, lalu jalankan ulang.');
    }
    throw error;
  }
}

function releaseLock() {
  try {
    if (lockFd !== undefined) fs.closeSync(lockFd);
  } catch {}
  lockFd = undefined;
  try {
    fs.rmSync(lockFile, { force: true });
  } catch {}
}

async function main() {
  acquireLock();
  if (process.platform !== 'win32') {
    console.warn('Build Windows berjalan dari host non-Windows. Build NSIS memerlukan Wine; build pada Windows direkomendasikan.');
  }
  run(npm, ['run', 'build']);
  run(npm, ['run', 'prepare:desktop']);
  if (fs.existsSync(nativeBinary)) {
    fs.copyFileSync(nativeBinary, nativeBackup);
    hasNativeBackup = true;
  }
  const builderArgs = [path.join(root, 'node_modules', 'electron-builder', 'cli.js'), '--win', 'nsis', '--x64'];
  if (process.platform !== 'win32') {
    // better-sqlite3 v13 ships N-API prebuilds for every target, so no native
    // rebuild is needed. @electron/rebuild cannot cross-compile from source,
    // which would otherwise abort the build on macOS/Linux hosts.
    builderArgs.push('--config.npmRebuild=false');
  }
  run(process.execPath, builderArgs);
  console.log('Installer Windows selesai dibuat di folder release/.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => {
  if (hasNativeBackup) fs.copyFileSync(nativeBackup, nativeBinary);
  releaseLock();
  fs.rmSync(temp, { recursive: true, force: true });
});

process.on('exit', releaseLock);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    releaseLock();
    process.exit(1);
  });
}
