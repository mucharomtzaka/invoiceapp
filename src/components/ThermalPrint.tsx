'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bluetooth, CheckCircle2, Download, Loader2, Printer, Usb, X } from 'lucide-react';
import type { ReceiptDraft } from '@/lib/types';
import { buildPrinterTest, buildReceiptEscPos, buildReceiptText, type ThermalPrintOptions, type ThermalWidth } from '@/lib/escpos';
import { receiptImageLayout } from '@/lib/receipt-image';
import { loadLogoImage, loadLogoRaster } from '@/lib/thermal-logo';
import {
  BluetoothThermalPrinter,
  cancelDesktopBluetoothSelection,
  isBluetoothPrintingSupported,
  isDesktopShell,
  onDesktopBluetoothDevices,
  selectDesktopBluetoothDevice,
  type BluetoothDeviceChoice,
  type BluetoothWriteMode,
} from '@/lib/bluetooth-printer';
import {
  UsbThermalPrinter,
  cancelDesktopUsbSelection,
  isUsbPrintingSupported,
  onDesktopUsbDevices,
  selectDesktopUsbDevice,
  usbErrorDetail,
  type UsbDeviceChoice,
} from '@/lib/usb-printer';
import { listOsPrinters, type OsPrinter } from '@/lib/os-printers';

type Props = {
  data: ReceiptDraft;
  business: any;
  toast: (message: string) => void;
  label?: string;
};

type Transport = 'bluetooth' | 'usb';
type DeviceChoice = { deviceId: string; deviceName: string };

/** Antarmuka bersama printer Bluetooth BLE dan USB (keduanya ESC/POS). */
type ThermalPrinter = {
  connected: boolean;
  deviceName: string;
  onDisconnect: (() => void) | null;
  connect: (options?: { allDevices?: boolean }) => Promise<unknown>;
  disconnect: () => void | Promise<void>;
  print: (
    bytes: Uint8Array,
    options?: { mode?: BluetoothWriteMode; chunkSize?: number; delayMs?: number },
  ) => Promise<void>;
};

export function ThermalPrintButton({ data, business, toast, label = 'Cetak thermal' }: Props) {
  const [open, setOpen] = useState(false);
  const [transport, setTransport] = useState<Transport>('bluetooth');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [deviceName, setDeviceName] = useState('');
  const [choices, setChoices] = useState<DeviceChoice[]>([]);
  const [error, setError] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [bluetoothSupported, setBluetoothSupported] = useState<boolean | null>(null);
  const [usbSupported, setUsbSupported] = useState<boolean | null>(null);
  const [desktop, setDesktop] = useState(false);
  const [osPrinters, setOsPrinters] = useState<OsPrinter[]>([]);
  const printerRef = useRef<ThermalPrinter | null>(null);
  const mountedRef = useRef(true);
  const attemptRef = useRef(0);
  const widthTouchedRef = useRef(false);

  const [options, setOptions] = useState<ThermalPrintOptions>({
    width: data.paperSize.includes('80') ? 80 : 58,
    copies: 1,
    cut: true,
    openDrawer: false,
    feedLines: 3,
    showCustomer: true,
    showNotes: true,
    showFooter: true,
  });
  const [writeMode, setWriteMode] = useState<BluetoothWriteMode>('auto');
  const [btChunkSize, setBtChunkSize] = useState(20);
  const [usbChunkSize, setUsbChunkSize] = useState(1024);

  const supported = transport === 'usb' ? usbSupported : bluetoothSupported;
  const thermalOsPrinters = osPrinters.filter(printer => printer.thermal);

  useEffect(() => {
    mountedRef.current = true;
    setBluetoothSupported(isBluetoothPrintingSupported());
    setUsbSupported(isUsbPrintingSupported());
    setDesktop(isDesktopShell());
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1;
      cancelDesktopBluetoothSelection();
      cancelDesktopUsbSelection();
      void printerRef.current?.disconnect();
      printerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open || !desktop) return;
    const handleDevices = (devices: DeviceChoice[]) => {
      if (mountedRef.current) setChoices(devices);
    };
    const unsubscribe = transport === 'usb'
      ? onDesktopUsbDevices(handleDevices as (devices: UsbDeviceChoice[]) => void)
      : onDesktopBluetoothDevices(handleDevices as (devices: BluetoothDeviceChoice[]) => void);
    return unsubscribe;
  }, [open, desktop, transport]);

  useEffect(() => {
    if (!open || !desktop) return;
    let cancelled = false;
    void listOsPrinters().then(printers => {
      if (cancelled || !mountedRef.current) return;
      setOsPrinters(printers);
      if (widthTouchedRef.current) return;
      const widths = new Set(
        printers
          .filter(printer => printer.thermal)
          .map(printer => printer.width)
          .filter((width): width is 58 | 80 => width === 58 || width === 80),
      );
      if (widths.size === 1) {
        const width = [...widths][0];
        setOptions(current => (current.width === width ? current : { ...current, width }));
      }
    });
    return () => {
      cancelled = true;
      widthTouchedRef.current = false;
    };
  }, [open, desktop]);

  const preview = useMemo(() => buildReceiptText(data, business, options), [data, business, options]);

  function selectTransport(next: Transport) {
    if (next === transport) return;
    attemptRef.current += 1;
    cancelDesktopBluetoothSelection();
    cancelDesktopUsbSelection();
    void printerRef.current?.disconnect();
    printerRef.current = null;
    setChoices([]);
    clearError();
    setStatus('idle');
    setDeviceName('');
    setTransport(next);
  }

  function showError(message: string, cause?: unknown) {
    setError(message);
    setErrorDetail(cause === undefined ? '' : usbErrorDetail(cause));
  }

  function clearError() {
    setError('');
    setErrorDetail('');
  }

  async function connect(allDevices = false) {
    const isUsb = transport === 'usb';
    if (!supported) {
      showError(isUsb
        ? 'Peramban ini tidak mendukung WebUSB. Gunakan Chrome/Edge versi terbaru melalui HTTPS atau localhost, maupun aplikasi desktop InvoiceApp.'
        : 'Peramban ini tidak mendukung Web Bluetooth. Gunakan Chrome, Edge, atau aplikasi desktop InvoiceApp.');
      return;
    }
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    setStatus('connecting');
    clearError();
    setChoices([]);
    try {
      const printer: ThermalPrinter = isUsb ? new UsbThermalPrinter() : new BluetoothThermalPrinter();
      printer.onDisconnect = () => {
        if (!mountedRef.current) return;
        setStatus('idle');
        setDeviceName('');
        showError(`Koneksi printer ${isUsb ? 'USB' : 'Bluetooth'} terputus. Hubungkan kembali sebelum mencetak.`);
      };
      await printer.connect(isUsb ? { allDevices } : undefined);
      if (!mountedRef.current || attempt !== attemptRef.current) {
        void printer.disconnect();
        return;
      }
      void printerRef.current?.disconnect();
      printerRef.current = printer;
      setDeviceName(printer.deviceName);
      setStatus('connected');
      toast(`Printer ${isUsb ? 'USB' : 'Bluetooth'} terhubung: ${printer.deviceName}`);
    } catch (cause) {
      if (!mountedRef.current || attempt !== attemptRef.current) return;
      setStatus('idle');
      showError(cause instanceof Error ? cause.message : 'Printer gagal dihubungkan.', cause);
    } finally {
      if (mountedRef.current && attempt === attemptRef.current) setChoices([]);
    }
  }

  function close() {
    attemptRef.current += 1;
    cancelDesktopBluetoothSelection();
    cancelDesktopUsbSelection();
    if (status === 'connecting') setStatus('idle');
    setChoices([]);
    setOpen(false);
  }

  function choose(choice: DeviceChoice) {
    setChoices([]);
    if (transport === 'usb') selectDesktopUsbDevice(choice.deviceId);
    else selectDesktopBluetoothDevice(choice.deviceId);
  }

  function disconnect() {
    void printerRef.current?.disconnect();
    printerRef.current = null;
    setStatus('idle');
    setDeviceName('');
    clearError();
  }

  function printOptions() {
    return transport === 'usb' ? { chunkSize: usbChunkSize } : { mode: writeMode, chunkSize: btChunkSize };
  }

  async function print() {
    const printer = printerRef.current;
    if (!printer?.connected) {
      showError(`Hubungkan printer ${transport === 'usb' ? 'USB' : 'Bluetooth'} terlebih dahulu.`);
      return;
    }
    if (!data.items.length || data.items.every(item => !item.name.trim())) {
      showError('Isi minimal satu item sebelum mencetak struk.');
      return;
    }
    setBusy(true);
    clearError();
    try {
      const logoRaster = business?.logo ? await loadLogoRaster(business.logo, options.width === 80 ? 576 : 384) : null;
      const bytes = buildReceiptEscPos(data, business, { ...options, logoRaster: logoRaster ?? undefined });
      await printer.print(bytes, printOptions());
      toast(`Struk berhasil dikirim ke printer ${transport === 'usb' ? 'USB' : 'Bluetooth'}.`);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'Struk gagal dicetak.', cause);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function downloadPng() {
    if (!data.items.length || data.items.every(item => !item.name.trim())) {
      showError('Isi minimal satu item sebelum mengunduh struk.');
      return;
    }
    setBusy(true);
    clearError();
    try {
      const columns = options.width === 80 ? 48 : 32;
      const font = '16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      const measuring = document.createElement('canvas').getContext('2d');
      if (!measuring) throw new Error('Canvas tidak tersedia di peramban ini.');
      measuring.font = font;
      const charWidth = Math.max(6, Math.ceil(measuring.measureText('M').width));
      const lineHeight = 22;
      const padding = 16;
      const scale = 3;

      const logo = business?.logo ? await loadLogoImage(business.logo, 120) : null;
      const logoHeight = logo ? logo.height + 12 : 0;

      const copies = Math.max(1, Math.min(9, options.copies || 1));
      const feedLines = Math.max(0, Math.min(10, options.feedLines ?? 3));
      const { width, height, lines } = receiptImageLayout(
        preview,
        columns,
        copies,
        feedLines,
        charWidth,
        lineHeight,
        padding,
      );

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = (height + logoHeight) * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia di peramban ini.');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height + logoHeight);
      if (logo) {
        const x = Math.max(0, (width - logo.width) / 2);
        ctx.drawImage(logo.image, x, padding, logo.width, logo.height);
      }
      ctx.fillStyle = '#000000';
      ctx.font = font;
      ctx.textBaseline = 'top';
      lines.forEach((line, index) => ctx.fillText(line, padding, padding + logoHeight + index * lineHeight));

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Gagal membuat gambar PNG.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `struk-${(data.receiptNumber || 'thermal').replace(/[^a-z0-9-_]+/gi, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Struk PNG berhasil diunduh.');
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'Gagal mengunduh struk PNG.', cause);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function testPrinter() {
    const printer = printerRef.current;
    if (!printer?.connected) {
      showError(`Hubungkan printer ${transport === 'usb' ? 'USB' : 'Bluetooth'} terlebih dahulu.`);
      return;
    }
    setBusy(true);
    clearError();
    try {
      await printer.print(buildPrinterTest(), printOptions());
      toast('Tes printer berhasil dikirim. Periksa hasil cetak pada printer.');
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'Tes printer gagal.', cause);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  const set = <K extends keyof ThermalPrintOptions>(key: K, value: ThermalPrintOptions[K]) =>
    setOptions(current => ({ ...current, [key]: value }));

  return (
    <>
      <div className="inline" style={{ gap: 6 }}>
        <button type="button" className="btn small" onClick={() => { clearError(); setOpen(true); }} title="Cetak struk thermal via Bluetooth atau USB">
          <Printer size={14} /> {label}
        </button>
        <button type="button" className="btn small" onClick={downloadPng} disabled={busy} title="Unduh struk sebagai gambar PNG">
          {busy ? <Loader2 size={14} className="tp-spin" /> : <Download size={14} />} Unduh PNG
        </button>
      </div>
      {open && (
        <div className="tp-overlay no-print" role="presentation" onClick={close}>
          <div className="tp-dialog" role="dialog" aria-modal="true" aria-label="Cetak thermal" onClick={event => event.stopPropagation()}>
            <div className="tp-head">
              <div>
                <h2 style={{ fontSize: 16, margin: 0 }}>Cetak Thermal</h2>
                <p className="eyebrow" style={{ marginTop: 4 }}>ESC/POS · Bluetooth BLE / USB · 58 mm / 80 mm</p>
              </div>
              <button type="button" className="btn small" onClick={close} aria-label="Tutup">
                <X size={14} />
              </button>
            </div>

            <div className="tp-body">
              <div className="tp-tabs" role="group" aria-label="Jenis koneksi printer">
                <button type="button" className={transport === 'bluetooth' ? 'active' : ''} onClick={() => selectTransport('bluetooth')}>
                  <Bluetooth size={14} /> Bluetooth
                </button>
                <button type="button" className={transport === 'usb' ? 'active' : ''} onClick={() => selectTransport('usb')}>
                  <Usb size={14} /> USB
                </button>
              </div>

              {desktop && thermalOsPrinters.length > 0 && (
                <div className="tp-note">
                  <b>Printer OS terdeteksi:</b> {thermalOsPrinters.map(printer => `${printer.displayName}${printer.width ? ` · ${printer.width} mm` : ''}`).join(' · ')}
                </div>
              )}

              {supported === false && (
                <div className="tp-note">
                  <b>{transport === 'usb' ? 'WebUSB' : 'Web Bluetooth'} tidak tersedia.</b> Pengaturan izin browser biasanya memblokir fitur ini.
                  Gunakan Chrome/Edge versi terbaru melalui HTTPS atau localhost, atau gunakan aplikasi desktop InvoiceApp.
                </div>
              )}

              <div className="tp-status">
                <span className={`tp-dot ${status === 'connected' ? 'on' : ''}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {status === 'connected' ? deviceName || `Printer ${transport === 'usb' ? 'USB' : 'Bluetooth'}` : status === 'connecting' ? 'Menghubungkan…' : 'Belum terhubung'}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {status === 'connected'
                      ? 'Siap menerima perintah cetak.'
                      : transport === 'usb'
                        ? 'Nyalakan printer dan sambungkan kabel USB data.'
                        : 'Nyalakan printer dan pastikan Bluetooth aktif.'}
                  </div>
                </div>
                {status === 'connected' ? (
                  <div className="inline" style={{ gap: 6 }}>
                    <button type="button" className="btn small" onClick={testPrinter} disabled={busy}>Tes</button>
                    <button type="button" className="btn small" onClick={disconnect}>Putuskan</button>
                  </div>
                ) : (
                  <button type="button" className="btn small primary" onClick={() => connect()} disabled={status === 'connecting' || !supported}>
                    {status === 'connecting'
                      ? <Loader2 size={14} className="tp-spin" />
                      : transport === 'usb' ? <Usb size={14} /> : <Bluetooth size={14} />}
                    {status === 'connecting' ? 'Mencari…' : 'Hubungkan'}
                  </button>
                )}
              </div>

              {choices.length > 0 && (
                <div className="tp-picker">
                  <div className="eyebrow" style={{ marginBottom: 6 }}>Pilih printer yang terdeteksi</div>
                  {choices.map(choice => (
                    <button key={choice.deviceId} type="button" className="btn small" style={{ justifyContent: 'flex-start' }} onClick={() => choose(choice)}>
                      <Printer size={14} /> {choice.deviceName}
                    </button>
                  ))}
                </div>
              )}

              {transport === 'usb' && status !== 'connected' && supported !== false && (
                <div className="tp-fallback">
                  <span>Printer tidak muncul di daftar?</span>
                  <button type="button" className="btn small" onClick={() => connect(true)} disabled={status === 'connecting'}>
                    Tampilkan semua perangkat USB
                  </button>
                </div>
              )}

              <div className="tp-grid">
                <label className="tp-field">
                  <span>Lebar kertas</span>
                  <select value={options.width} onChange={event => { widthTouchedRef.current = true; set('width', Number(event.target.value) as ThermalWidth); }}>
                    <option value={58}>Thermal 58 mm · 32 kolom</option>
                    <option value={80}>Thermal 80 mm · 48 kolom</option>
                  </select>
                </label>
                <label className="tp-field">
                  <span>Jumlah salinan</span>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={options.copies}
                    onChange={event => set('copies', Math.max(1, Math.min(9, Number(event.target.value) || 1)))}
                  />
                </label>
                {transport === 'bluetooth' ? (
                  <>
                    <label className="tp-field">
                      <span>Metode kirim</span>
                      <select value={writeMode} onChange={event => setWriteMode(event.target.value as BluetoothWriteMode)}>
                        <option value="auto">Otomatis</option>
                        <option value="response">Dengan konfirmasi</option>
                        <option value="withoutResponse">Tanpa konfirmasi</option>
                      </select>
                    </label>
                    <label className="tp-field">
                      <span>Ukuran paket data</span>
                      <select value={btChunkSize} onChange={event => setBtChunkSize(Number(event.target.value))}>
                        <option value={20}>Aman · 20 byte</option>
                        <option value={100}>Sedang · 100 byte</option>
                        <option value={180}>Cepat · 180 byte</option>
                        <option value={512}>Maksimal · 512 byte</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <label className="tp-field">
                    <span>Ukuran transfer</span>
                    <select value={usbChunkSize} onChange={event => setUsbChunkSize(Number(event.target.value))}>
                      <option value={64}>Aman · 64 byte</option>
                      <option value={512}>Sedang · 512 byte</option>
                      <option value={1024}>Cepat · 1 KB</option>
                      <option value={4096}>Maksimal · 4 KB</option>
                    </select>
                  </label>
                )}
              </div>

              <p className="eyebrow" style={{ margin: 0 }}>
                {transport === 'usb'
                  ? 'Gunakan kabel USB data (bukan kabel charger). Izin USB diberikan dengan memilih printer pada dialog pemilih perangkat — Windows tidak menampilkan pop-up izin USB. Jika muncul “Sistem menolak membuka perangkat”, printer memakai driver pabrikan: pasang driver WinUSB (misalnya lewat Zadig) atau gunakan Cetak / PDF.'
                  : 'Jika muncul pesan “GATT operation failed”, gunakan 20 byte dan metode “Tanpa konfirmasi”, serta pasangkan printer di pengaturan Bluetooth sistem.'}
              </p>

              <div className="tp-checks">
                <label className="tp-check"><input type="checkbox" checked={options.cut !== false} onChange={event => set('cut', event.target.checked)} /> Potong kertas</label>
                <label className="tp-check"><input type="checkbox" checked={Boolean(options.openDrawer)} onChange={event => set('openDrawer', event.target.checked)} /> Buka laci kasir</label>
                <label className="tp-check"><input type="checkbox" checked={options.showCustomer !== false} onChange={event => set('showCustomer', event.target.checked)} /> Tampilkan pelanggan</label>
                <label className="tp-check"><input type="checkbox" checked={options.showNotes !== false} onChange={event => set('showNotes', event.target.checked)} /> Tampilkan catatan</label>
                <label className="tp-check"><input type="checkbox" checked={options.showFooter !== false} onChange={event => set('showFooter', event.target.checked)} /> Tampilkan footer</label>
              </div>

              <div className="inline" style={{ gap: 6 }}>
                <button type="button" className="btn small" onClick={() => setShowPreview(value => !value)}>
                  {showPreview ? 'Sembunyikan pratinjau teks' : 'Lihat pratinjau teks struk'}
                </button>
              </div>
              {showPreview && <>{business?.logo && <img className="thermal-logo" src={business.logo} alt="Logo usaha" />}<pre className="tp-preview">{preview}</pre></>}

              {error && (
                <div className="tp-error">
                  <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  {error}
                  {errorDetail && (
                    <details className="tp-detail">
                      <summary>Detail teknis</summary>
                      <code>{errorDetail}</code>
                    </details>
                  )}
                </div>
              )}

              {status === 'connected' && !error && (
                <div className="tp-ok">
                  <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Nominal struk mengikuti perhitungan transaksi yang sama dengan pratinjau dan PDF.
                </div>
              )}
            </div>

            <div className="tp-foot">
              <button type="button" className="btn" onClick={close}>Tutup</button>
              <button type="button" className="btn primary" onClick={print} disabled={busy || status !== 'connected'}>
                {busy ? <Loader2 size={15} className="tp-spin" /> : <Printer size={15} />}
                {busy ? 'Mencetak…' : 'Cetak struk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
