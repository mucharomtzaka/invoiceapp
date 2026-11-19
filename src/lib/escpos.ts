import type { ReceiptDraft } from './types';
import { calculate, formatNumber } from './calculations.ts';

export type ThermalWidth = 58 | 80;

export type ThermalPrintOptions = {
  /** Lebar kertas thermal dalam milimeter. */
  width?: ThermalWidth;
  /** Jumlah salinan struk yang dicetak. */
  copies?: number;
  /** Kirim perintah potong kertas (jika printer mendukung). */
  cut?: boolean;
  /** Kirim perintah buka laci kasir (jika printer mendukung). */
  openDrawer?: boolean;
  /** Jumlah baris kosong sebelum potong. */
  feedLines?: number;
  showCustomer?: boolean;
  showNotes?: boolean;
  showFooter?: boolean;
  footerText?: string;
  /** Data raster logo (ESC/POS GS v 0), bila ada. */
  logoRaster?: { width: number; height: number; pixels: Uint8Array };
};

type Alignment = 'left' | 'center';
type TextSize = 'normal' | 'double';

type Block = {
  text: string;
  align: Alignment;
  bold: boolean;
  size: TextSize;
};

/** Jumlah kolom karakter Font A pada printer ESC/POS 203 dpi. */
export function thermalColumns(width: ThermalWidth): number {
  return width === 80 ? 48 : 32;
}

/** Ubah karakter non-ASCII menjadi padanan ASCII agar aman di semua printer. */
export function toAscii(text: string): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u00d7\u2715]/g, 'x')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7e\n]/g, '');
}

/** Nominal ringkas untuk struk: Rp350.000 */
export function thermalMoney(value: number): string {
  return `Rp${formatNumber(value)}`;
}

/** Kuantitas struk mendukung pecahan, mis. 20,5 liter. */
export function thermalQuantity(value: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(Number(value) || 0);
}

export function wrapText(text: string, columns: number): string[] {
  const clean = toAscii(text).trim();
  if (!clean) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of clean.split(/\s+/)) {
    let remaining = word;
    if (!current && remaining.length > columns) {
      while (remaining.length > columns) {
        lines.push(remaining.slice(0, columns));
        remaining = remaining.slice(columns);
      }
    }
    if (!remaining) continue;
    if (!current) current = remaining;
    else if (current.length + 1 + remaining.length <= columns) current += ` ${remaining}`;
    else {
      lines.push(current);
      current = remaining;
      while (current.length > columns) {
        lines.push(current.slice(0, columns));
        current = current.slice(columns);
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/** Baris dua kolom dengan nilai rata kanan. */
export function padLine(left: string, right: string, columns: number): string {
  const l = toAscii(left);
  const r = toAscii(right);
  const gap = columns - l.length - r.length;
  if (gap >= 1) return `${l}${' '.repeat(gap)}${r}`;
  const maxLeft = Math.max(0, columns - r.length - 1);
  return `${l.slice(0, maxLeft)} ${r}`.slice(0, columns);
}

function padCenter(text: string, columns: number): string {
  const value = toAscii(text);
  if (value.length >= columns) return value.slice(0, columns);
  const left = Math.max(0, Math.floor((columns - value.length) / 2));
  return `${' '.repeat(left)}${value}`;
}

function formatDate(value: string): string {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  return day && month && year ? `${day}-${month}-${year}` : String(value || '-');
}

function docTitle(type: string): string {
  if (type === 'payment') return 'BUKTI PEMBAYARAN';
  if (type === 'sale') return 'STRUK PENJUALAN';
  if (type === 'fuel') return 'BUKTI PEMBELIAN BBM';
  return 'KWITANSI';
}

function taxLabel(data: ReceiptDraft): string {
  const type = data.taxType;
  const value = Number(data.taxValue) || 0;
  return type === 'percent' && value > 0 ? `PPN ${formatNumber(value)}%` : 'PPN';
}

function buildBlocks(data: ReceiptDraft, business: any, options: ThermalPrintOptions): { blocks: Block[]; columns: number } {
  const width = options.width === 80 ? 80 : 58;
  const columns = thermalColumns(width);
  const blocks: Block[] = [];

  const push = (text = '', align: Alignment = 'left', bold = false, size: TextSize = 'normal') => {
    blocks.push({ text: toAscii(text), align, bold, size });
  };
  const pushWrapped = (text: string, align: Alignment = 'left', bold = false) => {
    for (const line of wrapText(text, columns)) push(line, align, bold);
  };
  const pushMeta = (label: string, value: string) => {
    const prefix = `${label.padEnd(10, ' ')}: `;
    const lines = wrapText(value || '-', Math.max(8, columns - prefix.length));
    lines.forEach((line, index) => push(index === 0 ? `${prefix}${line}` : `${' '.repeat(prefix.length)}${line}`));
  };

  const items = Array.isArray(data.items) ? data.items : [];
  const totals = calculate(
    items,
    data.discountType || 'none',
    Number(data.discountValue) || 0,
    data.taxType || 'none',
    Number(data.taxValue) || 0,
  );

  const businessName = toAscii(business?.businessName || 'Nama Usaha Anda').trim() || 'Nama Usaha Anda';
  const nameFitsDouble = businessName.length <= Math.floor(columns / 2);
  push(businessName, 'center', true, nameFitsDouble ? 'double' : 'normal');
  if (business?.address) pushWrapped(business.address, 'center');
  if (business?.phone) pushWrapped(`Telp. ${business.phone}`, 'center');
  if (business?.email) pushWrapped(business.email, 'center');
  if (business?.website) pushWrapped(business.website, 'center');

  push('='.repeat(columns));
  push(docTitle(data.transactionType), 'center', true);
  push('-'.repeat(columns));

  if (data.transactionType === 'fuel') pushMeta('No', data.receiptNumber || '-');
  pushMeta('Tanggal', formatDate(data.transactionDate));
  if (data.transactionType === 'fuel' && data.transactionTime) pushMeta('Waktu', data.transactionTime);
  if (data.cashierName) pushMeta('Kasir', data.cashierName);
  if (options.showCustomer !== false) pushMeta('Pelanggan', data.customerName || 'Umum');

  if (data.transactionType === 'fuel') {
    push('-'.repeat(columns));
    if (data.spbuId) pushMeta('ID SPBU', data.spbuId);
    if (data.spbuName) pushMeta('Nama SPBU', data.spbuName);
    pushMeta('Jenis BBM', data.fuelType || '-');
    pushMeta('Volume', `${thermalQuantity(Number(data.volume) || 0)} Liter`);
    pushMeta('Harga/Liter', thermalMoney(Number(data.pricePerLiter) || 0));
    if (data.vehicleNumber) pushMeta('Kendaraan', data.vehicleNumber);
    if (data.dispenserNumber) pushMeta('Dispenser', data.dispenserNumber);
  }

  push('-'.repeat(columns));
  items.forEach((item, index) => {
    pushWrapped(item.name || `Item ${index + 1}`);
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    push(padLine(`  ${thermalQuantity(quantity)} x ${thermalMoney(price)}`, thermalMoney(totals.itemTotals[index] || 0), columns));
    push();
  });
  if (blocks.length && blocks[blocks.length - 1].text === '') blocks.pop();

  push('-'.repeat(columns));
  push(padLine('Subtotal', thermalMoney(totals.subtotal), columns));
  if (totals.discountAmount > 0) push(padLine('Diskon', `-${thermalMoney(totals.discountAmount)}`, columns));
  if (data.showDpp) push(padLine(data.dppLabel || 'DPP', thermalMoney(totals.dpp), columns));
  if (totals.taxAmount > 0) push(padLine(taxLabel(data), thermalMoney(totals.taxAmount), columns));
  push('-'.repeat(columns));
  push(padLine('TOTAL', thermalMoney(totals.total), columns), 'left', true);

  push('-'.repeat(columns));
  push(padLine('Pembayaran', data.paymentMethod || '-', columns));
  push(padLine('Status', (data.paymentStatus || '-').toUpperCase(), columns));

  if (options.showNotes !== false) {
    if (data.notes) {
      push('-'.repeat(columns));
      pushWrapped(`Catatan: ${data.notes}`);
    }
    if (data.description) {
      pushWrapped(`Ket: ${data.description}`);
    }
  }

  if (options.showFooter !== false) {
    push();
    push('TERIMA KASIH', 'center', true);
    const footer = options.footerText ?? 'Terima kasih atas kepercayaan Anda';
    if (footer) pushWrapped(footer, 'center');
    push('='.repeat(columns));
  }

  return { blocks, columns };
}

/** Representasi teks struk untuk pratinjau di layar dan pengujian. */
export function buildReceiptText(data: ReceiptDraft, business: any, options: ThermalPrintOptions = {}): string {
  const { blocks, columns } = buildBlocks(data, business, options);
  return `${blocks.map(block => (block.align === 'center' ? padCenter(block.text, columns) : block.text)).join('\n')}\n`;
}

const ESC = 0x1b;
const GS = 0x1d;

function encodeAscii(text: string): Uint8Array {
  const clean = toAscii(text);
  const bytes = new Uint8Array(clean.length);
  for (let index = 0; index < clean.length; index++) bytes[index] = clean.charCodeAt(index) & 0x7f;
  return bytes;
}

/** Kemas piksel hitam-putih menjadi perintah ESC/POS GS v 0 (raster bitmap). */
export function encodeRaster(width: number, height: number, pixels: Uint8Array): Uint8Array {
  const columns = Math.ceil(width / 8);
  const data = new Uint8Array(columns * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[y * width + x]) data[y * columns + (x >> 3)] |= 1 << (7 - (x & 7));
    }
  }
  const header = new Uint8Array([
    GS, 0x76, 0x30, 0x00,
    columns & 0xff, (columns >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ]);
  const output = new Uint8Array(header.length + data.length);
  output.set(header, 0);
  output.set(data, header.length);
  return output;
}

class EscPosBuilder {
  private parts: Uint8Array[] = [];
  private align: Alignment | null = null;
  private bold: boolean | null = null;
  private size: TextSize | null = null;

  raw(...bytes: number[]) {
    this.parts.push(new Uint8Array(bytes));
    return this;
  }

  rawBytes(bytes: Uint8Array) {
    this.parts.push(bytes);
    return this;
  }

  text(value: string) {
    this.parts.push(encodeAscii(value));
    return this;
  }

  line() {
    return this.raw(0x0a);
  }

  setAlign(align: Alignment) {
    if (this.align === align) return this;
    this.align = align;
    return this.raw(ESC, 0x61, align === 'center' ? 0x01 : 0x00);
  }

  setBold(bold: boolean) {
    if (this.bold === bold) return this;
    this.bold = bold;
    return this.raw(ESC, 0x45, bold ? 0x01 : 0x00);
  }

  setSize(size: TextSize) {
    if (this.size === size) return this;
    this.size = size;
    return this.raw(GS, 0x21, size === 'double' ? 0x11 : 0x00);
  }

  feed(lines: number) {
    return this.raw(ESC, 0x64, Math.max(0, Math.min(255, Math.round(lines))));
  }

  cut() {
    return this.raw(GS, 0x56, 0x42, 0x00);
  }

  openDrawer() {
    return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa);
  }

  build(): Uint8Array {
    const total = this.parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    for (const part of this.parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }
}

/**
 * Perintah kecil untuk menguji jalur cetak tanpa mencetak transaksi.
 * Berguna saat mendiagnosis galat GATT sebelum mencetak struk penuh.
 */
export function buildPrinterTest(): Uint8Array {
  const builder = new EscPosBuilder();
  builder.raw(ESC, 0x40);
  builder.raw(ESC, 0x74, 0x00);
  builder.setAlign('center').setBold(true).setSize('double');
  builder.text('TES PRINTER').line();
  builder.setSize('normal').setBold(false);
  builder.text('Koneksi Bluetooth OK').line();
  builder.text('Siap mencetak struk').line();
  builder.setAlign('left').feed(3).cut();
  return builder.build();
}

/**
 * Bangun perintah ESC/POS lengkap untuk printer thermal Bluetooth 58 mm / 80 mm.
 * Semua nominal memakai mesin hitung yang sama dengan pratinjau dan PDF.
 */
export function buildReceiptEscPos(data: ReceiptDraft, business: any, options: ThermalPrintOptions = {}): Uint8Array {
  const { blocks } = buildBlocks(data, business, options);
  const copies = Math.max(1, Math.min(9, Math.round(Number(options.copies) || 1)));
  const feedLines = Math.max(0, Math.min(10, Math.round(Number(options.feedLines) ?? 3)));
  const builder = new EscPosBuilder();

  builder.raw(ESC, 0x40); // inisialisasi printer
  builder.raw(ESC, 0x74, 0x00); // codepage PC437
  builder.setAlign('left');

  if (options.logoRaster) {
    const { width, height, pixels } = options.logoRaster;
    builder.setAlign('center');
    builder.rawBytes(encodeRaster(width, height, pixels));
    builder.line();
    builder.setAlign('left');
  }

  for (let copy = 0; copy < copies; copy++) {
    for (const block of blocks) {
      builder.setAlign(block.align).setBold(block.bold).setSize(block.size);
      builder.text(block.text).line();
    }
    builder.setBold(false).setSize('normal').setAlign('left');
    if (copy < copies - 1) builder.feed(2);
  }

  if (options.openDrawer) builder.openDrawer();
  builder.feed(feedLines);
  if (options.cut !== false) builder.cut();

  return builder.build();
}
