/**
 * Koneksi printer thermal melalui USB (WebUSB) dan pengiriman data ESC/POS.
 *
 * Bekerja di Chrome/Edge (HTTPS atau localhost) dan aplikasi desktop Electron.
 * Tidak menambah dependensi: semua akses memakai WebUSB bawaan Chromium.
 */

export type UsbDeviceChoice = {
  deviceId: string;
  deviceName: string;
};

export type UsbPrintOptions = {
  /** Ukuran potongan data per transfer. Default 1024 byte. */
  chunkSize?: number;
  /** Jeda antar transfer dalam milidetik. Default 8 ms. */
  delayMs?: number;
};

export type UsbPrintTarget = {
  interfaceNumber: number;
  alternateSetting: number;
  endpointNumber: number;
  packetSize: number;
};

type UsbEndpointLike = {
  endpointNumber: number;
  direction: string;
  type: string;
  packetSize: number;
};

type UsbAlternateLike = {
  alternateSetting: number;
  interfaceClass: number;
  interfaceSubclass?: number;
  interfaceProtocol?: number;
  endpoints: UsbEndpointLike[];
};

type UsbInterfaceLike = {
  interfaceNumber: number;
  alternate?: UsbAlternateLike;
  alternates: UsbAlternateLike[];
};

type UsbConfigurationLike = {
  configurationValue: number;
  interfaces: UsbInterfaceLike[];
};

export type UsbDeviceLike = {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  opened: boolean;
  configuration: UsbConfigurationLike | null;
  open: () => Promise<void>;
  close: () => Promise<void>;
  selectConfiguration: (value: number) => Promise<void>;
  claimInterface: (interfaceNumber: number) => Promise<void>;
  releaseInterface: (interfaceNumber: number) => Promise<void>;
  selectAlternateInterface: (interfaceNumber: number, alternateSetting: number) => Promise<void>;
  clearHalt: (direction: 'in' | 'out', endpointNumber: number) => Promise<void>;
  transferOut: (endpointNumber: number, data: Uint8Array) => Promise<{ status: string; bytesWritten?: number }>;
};

type UsbFilter = {
  classCode?: number;
  vendorId?: number;
  productId?: number;
  subclassCode?: number;
  protocolCode?: number;
};

type UsbLike = {
  requestDevice: (options: { filters: UsbFilter[] }) => Promise<UsbDeviceLike>;
  getDevices?: () => Promise<UsbDeviceLike[]>;
  addEventListener?: (type: string, listener: (event: { device?: UsbDeviceLike }) => void) => void;
  removeEventListener?: (type: string, listener: (event: { device?: UsbDeviceLike }) => void) => void;
};

/**
 * Filter perangkat USB yang ditampilkan pada pemilih.
 *
 * - `classCode: 7` adalah kelas Printer.
 * - `classCode: 0xff` mencakup printer thermal yang memakai kelas vendor-specific
 *   (banyak printer 58 mm / 80 mm murah).
 * - Daftar vendorId menambah printer bermerek yang tetap muncul walaupun kelas
 *   antarmukanya tidak standar.
 */
export const USB_PRINTER_FILTERS: UsbFilter[] = [
  { classCode: 7 },
  { classCode: 0xff },
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0519 }, // Star Micronics
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x0a5f }, // Zebra
  { vendorId: 0x1d90 }, // Citizen
  { vendorId: 0x0dd4 }, // Custom
  { vendorId: 0x0b31 }, // Sewoo
  { vendorId: 0x0416 }, // Winbond (banyak printer thermal generik)
  { vendorId: 0x0483 }, // STMicroelectronics (Xprinter dan sejenisnya)
  { vendorId: 0x28e9 }, // Gainscha
  { vendorId: 0x0fe6 }, // Rongta
];

export type UsbConnectOptions = {
  /**
   * Tampilkan semua perangkat USB pada dialog pemilih, bukan hanya yang cocok
   * dengan filter kelas/vendor. Berguna untuk printer dengan deskriptor tidak
   * standar yang tidak muncul pada daftar biasa.
   */
  allDevices?: boolean;
};

/**
 * Filter kosong cocok dengan semua perangkat USB. Dipakai sebagai fallback
 * ketika printer tidak muncul pada filter kelas/vendor.
 */
export const USB_ALL_DEVICE_FILTERS: UsbFilter[] = [{}];

function getUsb(): UsbLike | null {
  if (typeof navigator === 'undefined') return null;
  const usb = (navigator as unknown as { usb?: UsbLike }).usb;
  return usb && typeof usb.requestDevice === 'function' ? usb : null;
}

export function isUsbPrintingSupported(): boolean {
  return getUsb() !== null;
}

export function buildUsbFilters(includeVendorSpecific = true): UsbFilter[] {
  return includeVendorSpecific ? [...USB_PRINTER_FILTERS] : USB_PRINTER_FILTERS.filter(filter => filter.classCode !== 0xff);
}

/**
 * Cari semua endpoint bulk OUT yang bisa dipakai mengirim ESC/POS.
 * Endpoint pada antarmuka kelas Printer (7) diprioritaskan, lalu vendor-specific.
 */
export function findPrintEndpoints(configuration: UsbConfigurationLike | null | undefined): UsbPrintTarget[] {
  if (!configuration) return [];
  const found: Array<{ target: UsbPrintTarget; score: number }> = [];
  for (const iface of configuration.interfaces ?? []) {
    const alternates = iface.alternates?.length ? iface.alternates : iface.alternate ? [iface.alternate] : [];
    for (const alternate of alternates) {
      for (const endpoint of alternate.endpoints ?? []) {
        if (endpoint.type !== 'bulk' || endpoint.direction !== 'out') continue;
        const classScore = alternate.interfaceClass === 7 ? 0 : alternate.interfaceClass === 0xff ? 1 : 2;
        const settingScore = alternate.alternateSetting === 0 ? 0 : 0.5;
        found.push({
          score: classScore + settingScore,
          target: {
            interfaceNumber: iface.interfaceNumber,
            alternateSetting: alternate.alternateSetting,
            endpointNumber: endpoint.endpointNumber,
            packetSize: endpoint.packetSize || 64,
          },
        });
      }
    }
  }
  return found.sort((a, b) => a.score - b.score).map(item => item.target);
}

export function findPrintEndpoint(configuration: UsbConfigurationLike | null | undefined): UsbPrintTarget | null {
  return findPrintEndpoints(configuration)[0] ?? null;
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function hex(value: number): string {
  return value.toString(16).padStart(4, '0').toUpperCase();
}

export function friendlyUsbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const name = error instanceof Error ? error.name : '';
  if (/no device selected|not found|cancel|chooser/i.test(message)) return 'Pemilihan printer USB dibatalkan atau tidak ada printer yang dipilih.';
  // Windows tidak punya dialog izin USB. Chromium menolak membuka perangkat
  // bila driver yang terpasang bukan WinUSB/libusbK, sehingga galatnya berupa
  // "Access denied" dan bukan permintaan izin yang bisa diklik.
  if (/access denied|securityerror|not authorized|operation not permitted/i.test(`${name} ${message}`)) {
    return 'Sistem menolak membuka perangkat USB. Di Windows, WebUSB hanya bisa memakai printer dengan driver WinUSB, bukan driver pabrikan. Pasang driver WinUSB (misalnya lewat Zadig) atau gunakan tombol Cetak / PDF.';
  }
  if (/notallowed|user agent or the platform|user denied|user gesture|active document|focused|visible/i.test(`${name} ${message}`)) {
    return 'Permintaan izin USB tidak dapat ditampilkan. Pastikan jendela aplikasi aktif dan terlihat, lalu tekan Hubungkan sekali lagi. Di Chrome/Edge, izin muncul sebagai dialog pemilih perangkat USB.';
  }
  if (/permission|denied|not allowed|blocked/i.test(message)) {
    return 'Izin USB ditolak. Gunakan Chrome/Edge melalui HTTPS atau localhost, lalu izinkan akses perangkat USB saat diminta.';
  }
  if (/unable to claim|claim interface|claim/i.test(message)) {
    return 'Antarmuka printer USB sedang dipakai proses atau driver lain. Tutup aplikasi printer lain, atau gunakan tombol Cetak / PDF. Di Windows, WebUSB memerlukan driver WinUSB.';
  }
  if (/disconnected|device unavailable|not connected|device was|network/i.test(message)) {
    return 'Printer USB terputus. Periksa kabel data lalu hubungkan kembali.';
  }
  if (/stall|babble|transfer/i.test(message)) {
    return 'Printer menghentikan transfer USB. Coba ukuran transfer “Aman · 64 byte”, lalu cetak lagi.';
  }
  if (/already open|busy|exclusive/i.test(message)) {
    return 'Printer USB sedang dipakai aplikasi atau tab lain. Tutup pemakaian tersebut lalu hubungkan kembali.';
  }
  if (/not supported|secure context|undefined/i.test(message)) {
    return 'Peramban ini tidak mendukung WebUSB. Gunakan Chrome, Edge, atau aplikasi desktop InvoiceApp.';
  }
  return message || 'Terjadi kesalahan saat menghubungi printer USB.';
}

/**
 * Galat USB dengan pesan ramah sekaligus menyimpan pesan asli Chromium.
 * Detail mentah ditampilkan di panel sebagai "Detail teknis" agar masalah
 * izin, driver, atau endpoint bisa dibedakan saat pengujian di lapangan.
 */
export class UsbPrinterError extends Error {
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = 'UsbPrinterError';
    this.detail = detail;
  }
}

export function toUsbError(error: unknown): UsbPrinterError {
  if (error instanceof UsbPrinterError) return error;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  return new UsbPrinterError(friendlyUsbError(error), detail);
}

export function usbErrorDetail(error: unknown): string {
  if (error instanceof UsbPrinterError) return error.detail;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return error == null ? '' : String(error);
}

/**
 * Printer thermal USB berbasis WebUSB.
 * Data ESC/POS dikirim ke endpoint bulk OUT pada antarmuka printer.
 */
export class UsbThermalPrinter {
  private device: UsbDeviceLike | null = null;
  private target: UsbPrintTarget | null = null;
  onDisconnect: (() => void) | null = null;

  private readonly handleDisconnected = (event: { device?: UsbDeviceLike }) => {
    const device = this.device;
    if (!device) return;
    const sameDevice = event.device === device
      || (event.device
        && event.device.vendorId === device.vendorId
        && event.device.productId === device.productId
        && event.device.serialNumber === device.serialNumber);
    if (!sameDevice) return;
    this.reset();
    this.onDisconnect?.();
  };

  get deviceName(): string {
    const device = this.device;
    if (!device) return 'Printer USB';
    return device.productName
      || [device.manufacturerName, `USB ${hex(device.vendorId)}:${hex(device.productId)}`].filter(Boolean).join(' ');
  }

  get connected(): boolean {
    return Boolean(this.device?.opened && this.target);
  }

  get endpointInfo(): string {
    const target = this.target;
    if (!target) return '';
    return `bulk OUT 0x${target.endpointNumber.toString(16).toUpperCase()} · interface ${target.interfaceNumber}`;
  }

  async connect(options: UsbConnectOptions = {}): Promise<this> {
    const usb = getUsb();
    if (!usb) {
      throw new Error('Peramban ini tidak mendukung WebUSB. Gunakan Chrome, Edge, atau aplikasi desktop InvoiceApp.');
    }

    this.reset();
    let device: UsbDeviceLike;
    const filters = options.allDevices ? USB_ALL_DEVICE_FILTERS : buildUsbFilters(true);
    try {
      device = await usb.requestDevice({ filters });
    } catch (error) {
      throw toUsbError(error);
    }

    try {
      if (!device.opened) await withTimeout(device.open(), 8000, 'Printer USB tidak merespons saat dibuka.');
      if (!device.configuration) await device.selectConfiguration(1);

      const candidates = findPrintEndpoints(device.configuration);
      if (!candidates.length) {
        throw new Error('Tidak ditemukan endpoint cetak (bulk OUT) pada printer USB. Pastikan perangkat adalah printer thermal ESC/POS.');
      }

      let lastClaimError: unknown = null;
      for (const target of candidates) {
        try {
          await device.claimInterface(target.interfaceNumber);
          if (target.alternateSetting !== 0) {
            await device.selectAlternateInterface(target.interfaceNumber, target.alternateSetting);
          }
          this.device = device;
          this.target = target;
          usb.addEventListener?.('disconnect', this.handleDisconnected);
          return this;
        } catch (error) {
          // Antarmuka ini dipakai driver lain; coba endpoint berikutnya.
          lastClaimError = error;
          try {
            await device.releaseInterface(target.interfaceNumber);
          } catch {
            // Antarmuka memang belum berhasil diklaim.
          }
        }
      }
      throw lastClaimError ?? new Error('Antarmuka printer USB tidak dapat dipakai. Tutup aplikasi printer lain lalu coba lagi.');
    } catch (error) {
      try {
        if (device.opened) await device.close();
      } catch {
        // Perangkat sudah tertutup.
      }
      this.reset();
      throw toUsbError(error);
    }
  }

  async print(bytes: Uint8Array, options: UsbPrintOptions = {}): Promise<void> {
    const device = this.device;
    const target = this.target;
    if (!device || !target) throw new Error('Printer USB belum terhubung.');

    const chunkSize = Math.max(64, Math.min(16384, Math.round(options.chunkSize ?? 1024)));
    const delayMs = Math.max(0, options.delayMs ?? 8);

    try {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.slice(offset, offset + chunkSize);
        await this.transfer(device, target, chunk);
        if (offset + chunkSize < bytes.length && delayMs > 0) await delay(delayMs);
      }
      if (!device.opened) throw new Error('Printer USB terputus saat mencetak.');
    } catch (error) {
      throw toUsbError(error);
    }
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    const target = this.target;
    this.reset();
    if (!device) return;
    try {
      if (target) await device.releaseInterface(target.interfaceNumber);
    } catch {
      // Antarmuka mungkin sudah dilepas otomatis.
    }
    try {
      if (device.opened) await device.close();
    } catch {
      // Perangkat mungkin sudah dicabut.
    }
  }

  private async transfer(device: UsbDeviceLike, target: UsbPrintTarget, chunk: Uint8Array): Promise<void> {
    let result = await withTimeout(
      device.transferOut(target.endpointNumber, chunk),
      10000,
      'Printer USB tidak merespons. Periksa kabel lalu coba lagi.',
    );
    if (result.status === 'stall') {
      try {
        await device.clearHalt('out', target.endpointNumber);
      } catch {
        // clearHalt tidak didukung pada sebagian perangkat.
      }
      result = await withTimeout(
        device.transferOut(target.endpointNumber, chunk),
        10000,
        'Printer USB tidak merespons setelah transfer dihentikan.',
      );
    }
    if (result.status !== 'ok') {
      throw new Error(`Printer menghentikan transfer USB (${result.status}).`);
    }
    if (typeof result.bytesWritten === 'number' && result.bytesWritten < chunk.length) {
      throw new Error('Data struk tidak terkirim seluruhnya. Coba ukuran transfer yang lebih kecil.');
    }
  }

  private reset(): void {
    const usb = getUsb();
    usb?.removeEventListener?.('disconnect', this.handleDisconnected);
    this.device = null;
    this.target = null;
  }
}

/**
 * Aplikasi desktop memakai pemilih perangkat sendiri karena Chromium di dalam
 * Electron tidak menampilkan dialog pemilih USB bawaan.
 */
export function onDesktopUsbDevices(callback: (devices: UsbDeviceChoice[]) => void): () => void {
  const bridge = (globalThis as { desktopBridge?: { onUsbDevices?: (cb: (devices: UsbDeviceChoice[]) => void) => void; offUsbDevices?: () => void } }).desktopBridge;
  if (!bridge?.onUsbDevices) return () => {};
  bridge.onUsbDevices(callback);
  return () => bridge.offUsbDevices?.();
}

export function selectDesktopUsbDevice(deviceId: string): void {
  const bridge = (globalThis as { desktopBridge?: { selectUsbDevice?: (id: string) => void } }).desktopBridge;
  bridge?.selectUsbDevice?.(deviceId);
}

export function cancelDesktopUsbSelection(): void {
  const bridge = (globalThis as { desktopBridge?: { cancelUsbSelection?: () => void } }).desktopBridge;
  bridge?.cancelUsbSelection?.();
}
