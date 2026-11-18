const { app, BrowserWindow, dialog, shell, session, ipcMain } = require('electron');
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

let mainWindow;
let httpServer;
let nextApp;
let logFile;
let pendingBluetoothCallback = null;
let pendingUsbCallback = null;

function getLogFile() {
  if (!logFile) logFile = path.join(app.getPath('userData'), 'logs', 'main.log');
  return logFile;
}

function appendLog(level, values) {
  try {
    const file = getLogFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `[${new Date().toISOString()}] [${level}] ${util.format(...values)}\n`, 'utf8');
  } catch {
    // Logging must never prevent the app from starting.
  }
}

// A packaged Electron app has no visible console, so mirror every message to
// a log file inside the user data directory to make startup failures diagnosable.
for (const level of ['log', 'info', 'warn', 'error']) {
  const write = console[level].bind(console);
  console[level] = (...values) => {
    write(...values);
    appendLog(level.toUpperCase(), values);
  };
}

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('InvoiceApp error', `${error?.stack || error}\n\nLog: ${getLogFile()}`);
  app.exit(1);
});

process.on('unhandledRejection', reason => {
  console.error('Unhandled rejection:', reason);
});

async function startNextServer() {
  process.env.NODE_ENV = 'production';
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  const dbPath = path.join(app.getPath('userData'), 'invoiceapp.db');
  const secretPath = path.join(app.getPath('userData'), 'auth-secret');
  console.log('Preparing local server', {
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    userData: app.getPath('userData'),
    dbPath,
  });
  if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, randomBytes(48).toString('hex'), { mode: 0o600 });
  if (!fs.existsSync(dbPath)) {
    const template = path.join(process.resourcesPath, 'initial.db');
    console.log('Creating database from template', template);
    fs.copyFileSync(template, dbPath);
  }
  // The Prisma better-sqlite3 adapter removes the `file:` prefix and passes
  // the remaining value directly to better-sqlite3. `pathToFileURL()` would
  // percent-encode spaces (for example, macOS's `Application Support`) and
  // make SQLite open a different, non-existent path.
  process.env.DATABASE_URL = `file:${dbPath.replaceAll('\\', '/')}`;
  process.env.AUTH_SECRET = fs.readFileSync(secretPath, 'utf8').trim();
  migrateUserManagement(dbPath);

  const next = require('next');
  nextApp = next({ dev: false, dir: app.getAppPath(), conf: { distDir: '.next' } });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();
  httpServer = createServer((req, res) => handle(req, res));
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const { port } = httpServer.address();
  const url = `http://127.0.0.1:${port}`;
  console.log('Local server ready', url);
  return url;
}

function migrateUserManagement(dbPath) {
  const Database = require('better-sqlite3');
  const database = new Database(dbPath);
  try {
    const columns = new Set(database.prepare('PRAGMA table_info("User")').all().map(column => column.name));
    if (!columns.has('role')) database.exec('ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT \'owner\'');
    if (!columns.has('ownerId')) database.exec('ALTER TABLE "User" ADD COLUMN "ownerId" TEXT');
    if (!columns.has('sessionVersion')) database.exec('ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0');
    database.exec('CREATE INDEX IF NOT EXISTS "User_ownerId_idx" ON "User"("ownerId")');
  } finally {
    database.close();
  }
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 920,
    minHeight: 680,
    show: false,
    backgroundColor: '#f6f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = window;
  window.once('ready-to-show', () => window.show());
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Window failed to load', { errorCode, errorDescription, validatedURL });
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Chromium meminta proses utama memilih perangkat Bluetooth. Daftar perangkat
  // diteruskan ke renderer agar pengguna bisa memilih printer thermal sendiri.
  // Event ini dapat terpicu berkali-kali selama pemindaian, jadi callback
  // terbaru disimpan tanpa membatalkan permintaan yang masih berjalan.
  window.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    pendingBluetoothCallback = callback;
    if (deviceList.length === 0) return;
    const devices = deviceList.map(device => ({
      deviceId: device.deviceId,
      deviceName: device.deviceName || 'Perangkat Bluetooth',
    }));
    console.log('Bluetooth devices found', devices);
    window.webContents.send('bluetooth:devices', devices);
  });
  // WebUSB memakai pemilih perangkat milik aplikasi karena Electron tidak
  // menampilkan dialog USB bawaan Chromium. Listener dipasang sekali pada
  // session (lihat configureUsbSelection) agar tidak menumpuk saat jendela
  // dibuat ulang di macOS.
  window.on('closed', () => {
    if (pendingBluetoothCallback) {
      pendingBluetoothCallback('');
      pendingBluetoothCallback = null;
    }
    if (pendingUsbCallback) {
      pendingUsbCallback();
      pendingUsbCallback = null;
    }
    mainWindow = null;
  });

  const url = app.isPackaged
    ? await startNextServer()
    : (process.env.ELECTRON_START_URL || 'http://localhost:3000');
  await window.loadURL(url);
}

app.commandLine.appendSwitch('enable-features', 'WebBluetooth,WebUSB');

ipcMain.on('bluetooth:select', (_event, deviceId) => {
  if (!pendingBluetoothCallback) return;
  const callback = pendingBluetoothCallback;
  pendingBluetoothCallback = null;
  callback(String(deviceId || ''));
});

ipcMain.on('bluetooth:cancel', () => {
  if (!pendingBluetoothCallback) return;
  const callback = pendingBluetoothCallback;
  pendingBluetoothCallback = null;
  callback('');
});

ipcMain.on('usb:select', (_event, deviceId) => {
  if (!pendingUsbCallback) return;
  const callback = pendingUsbCallback;
  pendingUsbCallback = null;
  callback(String(deviceId || ''));
});

ipcMain.on('usb:cancel', () => {
  if (!pendingUsbCallback) return;
  const callback = pendingUsbCallback;
  pendingUsbCallback = null;
  // Tanpa argumen berarti pengguna membatalkan pemilihan perangkat.
  callback();
});

function isLocalOrigin(origin) {
  if (!origin) return false;
  if (origin.startsWith('file://')) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'http:' || protocol === 'https:'
      ? hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1'
      : false;
  } catch {
    return false;
  }
}

function configurePermissions() {
  const ses = session.defaultSession;
  const allow = permission => permission === 'bluetooth' || permission === 'usb' || permission === 'fullscreen';
  ses.setPermissionCheckHandler((_webContents, permission) => allow(permission));
  ses.setPermissionRequestHandler((_webContents, permission, callback) => callback(allow(permission)));
  // Perangkat USB yang sudah dipilih pengguna pada pemilih aplikasi diizinkan
  // untuk origin lokal aplikasi ini. Tanpa handler ini Chromium dapat menolak
  // akses perangkat setelah pemilihan selesai.
  ses.setDevicePermissionHandler(details => {
    if (details?.deviceType !== 'usb') return false;
    return isLocalOrigin(details.origin);
  });
}

// Dipanggil sekali setelah app siap. Chromium meminta proses utama memilih
// perangkat USB saat halaman memanggil navigator.usb.requestDevice().
function configureUsbSelection() {
  session.defaultSession.on('select-usb-device', (event, details, callback) => {
    event.preventDefault();
    pendingUsbCallback = callback;
    const deviceList = details?.deviceList || [];
    if (deviceList.length === 0 || !mainWindow) {
      // Tidak ada perangkat yang cocok: batalkan agar promise di renderer
      // tidak menggantung dan panel bisa menampilkan pesan galat.
      pendingUsbCallback = null;
      callback();
      return;
    }
    const devices = deviceList.map(device => {
      const vendor = device.vendorId.toString(16).padStart(4, '0').toUpperCase();
      const product = device.productId.toString(16).padStart(4, '0').toUpperCase();
      const label = device.productName || device.manufacturerName || 'Printer USB';
      return {
        deviceId: device.deviceId,
        deviceName: `${label} (${vendor}:${product})`,
      };
    });
    console.log('USB devices found', devices);
    mainWindow.webContents.send('usb:devices', devices);
  });
}

app.setAppLogsPath();

app.whenReady().then(async () => {
  try {
    configurePermissions();
    configureUsbSelection();
    console.log(`InvoiceApp ${app.getVersion()} starting`, {
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      node: process.versions.node,
      packaged: app.isPackaged,
      logFile: getLogFile(),
    });
    await createWindow();
  } catch (error) {
    console.error('InvoiceApp failed to start:', error);
    dialog.showErrorBox(
      'InvoiceApp tidak dapat dibuka',
      `${error?.stack || error}\n\nLog lengkap: ${getLogFile()}`,
    );
    app.quit();
  }
});

app.on('render-process-gone', (_event, _contents, details) => {
  console.error('Renderer process gone:', details);
});

app.on('child-process-gone', (_event, details) => {
  console.error('Child process gone:', details);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  httpServer?.close();
  nextApp?.close?.();
});
