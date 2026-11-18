const { contextBridge, ipcRenderer } = require('electron');

// Jembatan minimal untuk fitur printer thermal. Renderer tetap memakai Web
// Bluetooth / WebUSB; preload hanya meneruskan daftar perangkat dari pemilih
// Electron dan pilihan pengguna.
contextBridge.exposeInMainWorld('desktopBridge', {
  isDesktop: true,
  selectBluetoothDevice: deviceId => ipcRenderer.send('bluetooth:select', deviceId),
  cancelBluetoothSelection: () => ipcRenderer.send('bluetooth:cancel'),
  onBluetoothDevices: callback => {
    ipcRenderer.on('bluetooth:devices', (_event, devices) => callback(devices));
  },
  offBluetoothDevices: () => {
    ipcRenderer.removeAllListeners('bluetooth:devices');
  },
  selectUsbDevice: deviceId => ipcRenderer.send('usb:select', deviceId),
  cancelUsbSelection: () => ipcRenderer.send('usb:cancel'),
  onUsbDevices: callback => {
    ipcRenderer.on('usb:devices', (_event, devices) => callback(devices));
  },
  offUsbDevices: () => {
    ipcRenderer.removeAllListeners('usb:devices');
  },
  listPrinters: () => ipcRenderer.invoke('printers:list'),
});
