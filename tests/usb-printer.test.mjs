import test from 'node:test';
import assert from 'node:assert/strict';
import { USB_ALL_DEVICE_FILTERS, buildUsbFilters, findPrintEndpoint, findPrintEndpoints, friendlyUsbError, toUsbError, usbErrorDetail } from '../src/lib/usb-printer.ts';

function configuration(interfaces) {
  return { configurationValue: 1, interfaces };
}

function iface(interfaceNumber, alternates) {
  return { interfaceNumber, alternates, alternate: alternates[0] };
}

function alt(alternateSetting, interfaceClass, endpoints) {
  return {
    alternateSetting,
    interfaceClass,
    interfaceSubclass: 1,
    interfaceProtocol: 2,
    endpoints,
  };
}

const out = (endpointNumber = 1, packetSize = 64) => ({ endpointNumber, direction: 'out', type: 'bulk', packetSize });
const inn = (endpointNumber = 2) => ({ endpointNumber, direction: 'in', type: 'bulk', packetSize: 64 });
const interruptOut = () => ({ endpointNumber: 3, direction: 'out', type: 'interrupt', packetSize: 8 });

test('endpoint bulk OUT pada antarmuka printer dipilih lebih dulu', () => {
  const config = configuration([
    iface(0, [alt(0, 0xff, [out(4)])]),
    iface(1, [alt(0, 7, [inn(5), out(6)])]),
  ]);
  const targets = findPrintEndpoints(config);
  assert.equal(targets.length, 2);
  assert.deepEqual(targets[0], {
    interfaceNumber: 1,
    alternateSetting: 0,
    endpointNumber: 6,
    packetSize: 64,
  });
  assert.deepEqual(targets[1], {
    interfaceNumber: 0,
    alternateSetting: 0,
    endpointNumber: 4,
    packetSize: 64,
  });
});

test('endpoint bulk IN dan interrupt tidak dianggap jalur cetak', () => {
  const config = configuration([iface(0, [alt(0, 7, [inn(1), interruptOut()])])]);
  assert.equal(findPrintEndpoint(config), null);
  assert.deepEqual(findPrintEndpoints(config), []);
});

test('alternate setting 0 diprioritaskan pada kelas antarmuka yang sama', () => {
  const config = configuration([
    iface(0, [
      alt(1, 0xff, [out(1, 512)]),
      alt(0, 0xff, [out(2, 64)]),
    ]),
  ]);
  assert.equal(findPrintEndpoint(config).alternateSetting, 0);
  assert.equal(findPrintEndpoint(config).endpointNumber, 2);
});

test('konfigurasi kosong atau tidak tersedia tidak menghasilkan endpoint', () => {
  assert.deepEqual(findPrintEndpoints(null), []);
  assert.deepEqual(findPrintEndpoints(undefined), []);
  assert.deepEqual(findPrintEndpoints(configuration([])), []);
});

test('filter USB mencakup kelas printer dan vendor-specific', () => {
  const filters = buildUsbFilters(true);
  assert.ok(filters.some(filter => filter.classCode === 7));
  assert.ok(filters.some(filter => filter.classCode === 0xff));
  assert.ok(filters.some(filter => filter.vendorId === 0x04b8));
  assert.ok(filters.every(filter => filter.classCode !== undefined || filter.vendorId !== undefined));
});

test('filter ketat tidak menyertakan kelas vendor-specific', () => {
  const filters = buildUsbFilters(false);
  assert.ok(filters.every(filter => filter.classCode !== 0xff));
  assert.ok(filters.some(filter => filter.classCode === 7));
});

test('filter fallback berupa filter kosong yang cocok dengan semua perangkat', () => {
  assert.deepEqual(USB_ALL_DEVICE_FILTERS, [{}]);
});

test('pesan galat USB menjelaskan klaim antarmuka dan pemilihan yang dibatalkan', () => {
  assert.match(friendlyUsbError(new Error('Failed to claim interface 0: Unable to claim interface.')), /WinUSB|driver/i);
  assert.match(friendlyUsbError(new Error('No device selected.')), /dibatalkan/i);
  assert.match(friendlyUsbError(new Error('Access denied to device')), /menolak membuka perangkat USB/i);
  assert.match(friendlyUsbError(new Error('The device was disconnected.')), /terputus/i);
});

test('galat Access denied dipetakan ke petunjuk driver WinUSB, bukan izin pop-up', () => {
  const security = new Error('Access denied to device');
  security.name = 'SecurityError';
  const message = friendlyUsbError(security);
  assert.match(message, /WinUSB/i);
  assert.doesNotMatch(message, /saat diminta/i);
});

test('permintaan izin yang tidak bisa tampil meminta jendela difokuskan', () => {
  const error = new Error('Must be handling a user gesture to show a permission request.');
  error.name = 'NotAllowedError';
  assert.match(friendlyUsbError(error), /jendela aplikasi aktif/i);
});

test('toUsbError menyimpan detail asli dan usbErrorDetail mengembalikannya', () => {
  const raw = new Error('Access denied to device');
  const wrapped = toUsbError(raw);
  assert.equal(wrapped.name, 'UsbPrinterError');
  assert.match(wrapped.message, /driver|WinUSB|perangkat/i);
  assert.equal(usbErrorDetail(wrapped), 'Error: Access denied to device');
  assert.equal(toUsbError(wrapped), wrapped);
  assert.equal(usbErrorDetail(raw), 'Error: Access denied to device');
});
