export type BluetoothDeviceChoice = {
  deviceId: string;
  deviceName: string;
};

/** Metode penulisan GATT. Beberapa printer hanya menerima salah satunya. */
export type BluetoothWriteMode = 'auto' | 'response' | 'withoutResponse';

export type BluetoothPrintOptions = {
  mode?: BluetoothWriteMode;
  chunkSize?: number;
  delayMs?: number;
};

type GattCharacteristicLike = {
  uuid: string;
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue?: (value: Uint8Array) => Promise<void>;
  writeValueWithResponse?: (value: Uint8Array) => Promise<void>;
  writeValueWithoutResponse?: (value: Uint8Array) => Promise<void>;
};

type GattServiceLike = {
  uuid: string;
  getCharacteristics: () => Promise<GattCharacteristicLike[]>;
};

type GattServerLike = {
  connected: boolean;
  connect: () => Promise<GattServerLike>;
  disconnect: () => void;
  getPrimaryServices: () => Promise<GattServiceLike[]>;
};

type BluetoothDeviceLike = {
  id: string;
  name?: string;
  gatt?: GattServerLike;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type BluetoothLike = {
  requestDevice: (options: Record<string, unknown>) => Promise<BluetoothDeviceLike>;
  getAvailability?: () => Promise<boolean>;
};

/**
 * UUID service GATT yang umum dipakai printer thermal ESC/POS (58 mm / 80 mm).
 * Daftar ini harus dikirim sebagai optionalServices saat meminta perangkat,
 * karena Chromium hanya mengizinkan akses service yang dideklarasikan.
 */
export const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ff90-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ffb0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
] as const;

function getBluetooth(): BluetoothLike | null {
  if (typeof navigator === 'undefined') return null;
  const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth;
  return bluetooth && typeof bluetooth.requestDevice === 'function' ? bluetooth : null;
}

export function isBluetoothPrintingSupported(): boolean {
  return getBluetooth() !== null;
}

export function isDesktopShell(): boolean {
  return Boolean((globalThis as { desktopBridge?: { isDesktop?: boolean } }).desktopBridge?.isDesktop);
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function friendlyBluetoothError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/cancelled|canceled|user cancel|chooser/i.test(message)) return 'Pemilihan printer dibatalkan.';
  if (/permission|denied|not allowed|blocked/i.test(message)) return 'Izin Bluetooth ditolak. Aktifkan izin Bluetooth lalu coba lagi.';
  if (/gatt operation failed|unknown reason|att error|not permitted|insufficient authentication/i.test(message)) {
    return 'Printer menolak operasi GATT. Pasangkan (pair) printer di pengaturan Bluetooth sistem, pilih ukuran kirim "Aman (20 byte)", lalu coba metode kirim "Tanpa konfirmasi" jika masih gagal.';
  }
  if (/no services|service not found|not found/i.test(message)) return 'Printer tidak menyediakan service cetak yang dikenali. Pastikan printer dalam mode Bluetooth LE/BLE.';
  if (/gatt|disconnect|network/i.test(message)) return 'Koneksi printer terputus. Dekatkan printer lalu hubungkan kembali.';
  if (/not available|powered off|adapter/i.test(message)) return 'Bluetooth tidak aktif. Nyalakan Bluetooth perangkat lalu coba lagi.';
  return message || 'Terjadi kesalahan saat menghubungi printer Bluetooth.';
}

/**
 * Koneksi printer thermal melalui Web Bluetooth (BLE) dan pengiriman data ESC/POS.
 * Bekerja di Chrome/Edge dan aplikasi desktop Electron.
 */
export class BluetoothThermalPrinter {
  private device: BluetoothDeviceLike | null = null;
  private characteristic: GattCharacteristicLike | null = null;
  private serviceUuid = '';
  private readonly handleDisconnected = () => {
    this.characteristic = null;
    this.onDisconnect?.();
  };

  onDisconnect: (() => void) | null = null;

  get deviceName(): string {
    return this.device?.name || 'Printer Bluetooth';
  }

  get connected(): boolean {
    return Boolean(this.characteristic && this.device?.gatt?.connected);
  }

  get characteristicUuid(): string {
    return this.characteristic?.uuid || '';
  }

  get activeServiceUuid(): string {
    return this.serviceUuid;
  }

  get writeMode(): 'withResponse' | 'withoutResponse' | null {
    return this.characteristic ? characteristicWriteMode(this.characteristic) : null;
  }

  async connect(): Promise<this> {
    const bluetooth = getBluetooth();
    if (!bluetooth) {
      throw new Error('Peramban ini tidak mendukung Web Bluetooth. Gunakan Chrome, Edge, atau aplikasi desktop InvoiceApp.');
    }
    if (bluetooth.getAvailability) {
      try {
        const available = await bluetooth.getAvailability();
        if (!available) throw new Error('Bluetooth tidak aktif atau tidak tersedia di perangkat ini.');
      } catch (error) {
        if (error instanceof Error && /tidak aktif|tidak tersedia/i.test(error.message)) throw error;
      }
    }

    this.reset();
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [...PRINTER_SERVICE_UUIDS],
    });

    try {
      const server = await device.gatt?.connect();
      if (!server) throw new Error('Printer tidak dapat dihubungkan.');
      const services = await server.getPrimaryServices();
      const ordered = [...services].sort((a, b) => {
        const indexA = PRINTER_SERVICE_UUIDS.indexOf(a.uuid.toLowerCase() as (typeof PRINTER_SERVICE_UUIDS)[number]);
        const indexB = PRINTER_SERVICE_UUIDS.indexOf(b.uuid.toLowerCase() as (typeof PRINTER_SERVICE_UUIDS)[number]);
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
      });

      for (const service of ordered) {
        const characteristics = await service.getCharacteristics();
        const writable = characteristics.filter(characteristic => characteristicWriteMode(characteristic) !== null);
        if (writable.length) {
          // Utamakan karakteristik yang mendukung write-with-response karena
          // setiap paket dikonfirmasi printer, sehingga lebih stabil.
          const chosen = writable.find(characteristic => characteristicWriteMode(characteristic) === 'withResponse') ?? writable[0];
          this.device = device;
          this.characteristic = chosen;
          this.serviceUuid = service.uuid;
          device.addEventListener?.('gattserverdisconnected', this.handleDisconnected);
          // Beri waktu stack Bluetooth menyelesaikan service discovery.
          await delay(150);
          return this;
        }
      }
      throw new Error('Tidak ditemukan karakteristik tulis pada printer. Pastikan printer mendukung ESC/POS Bluetooth LE.');
    } catch (error) {
      try {
        if (device.gatt?.connected) device.gatt.disconnect();
      } catch {
        // Koneksi sudah tertutup.
      }
      this.reset();
      throw new Error(friendlyBluetoothError(error));
    }
  }

  async print(bytes: Uint8Array, options: BluetoothPrintOptions = {}): Promise<void> {
    const characteristic = this.characteristic;
    if (!characteristic) throw new Error('Printer belum terhubung.');

    const mode = resolveWriteMode(characteristic, options.mode ?? 'auto');
    // Default 20 byte adalah ukuran ATT yang aman untuk semua printer BLE.
    // Ukuran lebih besar dapat dipilih dari panel bila printer mendukung MTU besar.
    const chunkSize = Math.max(20, Math.min(512, Math.round(options.chunkSize ?? 20)));
    const delayMs = Math.max(0, options.delayMs ?? 15);
    try {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.slice(offset, offset + chunkSize);
        await this.writeChunk(characteristic, chunk, mode);
        if (offset + chunkSize < bytes.length) await delay(delayMs);
      }
    } catch (error) {
      throw new Error(friendlyBluetoothError(error));
    }
  }

  disconnect(): void {
    try {
      this.device?.removeEventListener?.('gattserverdisconnected', this.handleDisconnected);
      if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    } catch {
      // Abaikan kegagalan pemutusan koneksi.
    }
    this.reset();
  }

  private reset(): void {
    this.device = null;
    this.characteristic = null;
    this.serviceUuid = '';
  }

  private async writeChunk(characteristic: GattCharacteristicLike, chunk: Uint8Array, mode: 'withResponse' | 'withoutResponse'): Promise<void> {
    if (mode === 'withoutResponse') {
      if (!characteristic.writeValueWithoutResponse) throw new Error('Printer tidak mendukung pengiriman tanpa respons.');
      await characteristic.writeValueWithoutResponse(chunk);
      return;
    }
    if (characteristic.writeValueWithResponse) {
      await characteristic.writeValueWithResponse(chunk);
      return;
    }
    if (characteristic.writeValue) {
      await characteristic.writeValue(chunk);
      return;
    }
    throw new Error('Printer tidak menerima data cetak.');
  }
}

function characteristicWriteMode(characteristic: GattCharacteristicLike): 'withoutResponse' | 'withResponse' | null {
  // Wajib memakai properti GATT. Objek karakteristik Chromium selalu memiliki
  // metode writeValue lama, sehingga mengecek keberadaan metode saja bisa
  // memilih karakteristik notify-only dan memicu "GATT operation failed".
  if (characteristic.properties?.write) return 'withResponse';
  if (characteristic.properties?.writeWithoutResponse) return 'withoutResponse';
  return null;
}

function resolveWriteMode(
  characteristic: GattCharacteristicLike,
  requested: BluetoothWriteMode,
): 'withResponse' | 'withoutResponse' {
  const canWithResponse = Boolean(characteristic.properties?.write);
  const canWithoutResponse = Boolean(characteristic.properties?.writeWithoutResponse);
  if (requested === 'response') {
    if (canWithResponse) return 'withResponse';
    if (canWithoutResponse) return 'withoutResponse';
  } else if (requested === 'withoutResponse') {
    if (canWithoutResponse) return 'withoutResponse';
    if (canWithResponse) return 'withResponse';
  } else {
    if (canWithResponse) return 'withResponse';
    if (canWithoutResponse) return 'withoutResponse';
  }
  throw new Error('Printer tidak menerima data cetak.');
}

/**
 * Aplikasi desktop menampilkan daftar perangkat Bluetooth dari proses utama Electron
 * karena dialog pemilih bawaan Chromium tidak tersedia di jendela Electron.
 */
export function onDesktopBluetoothDevices(callback: (devices: BluetoothDeviceChoice[]) => void): () => void {
  const bridge = (globalThis as { desktopBridge?: { onBluetoothDevices?: (cb: (devices: BluetoothDeviceChoice[]) => void) => void; offBluetoothDevices?: () => void } }).desktopBridge;
  if (!bridge?.onBluetoothDevices) return () => {};
  bridge.onBluetoothDevices(callback);
  return () => bridge.offBluetoothDevices?.();
}

export function selectDesktopBluetoothDevice(deviceId: string): void {
  const bridge = (globalThis as { desktopBridge?: { selectBluetoothDevice?: (id: string) => void } }).desktopBridge;
  bridge?.selectBluetoothDevice?.(deviceId);
}

export function cancelDesktopBluetoothSelection(): void {
  const bridge = (globalThis as { desktopBridge?: { cancelBluetoothSelection?: () => void } }).desktopBridge;
  bridge?.cancelBluetoothSelection?.();
}
