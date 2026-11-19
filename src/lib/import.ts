import type { Item, ReceiptDraft } from './types';

const keyOf = (key: string) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

const KEY_MAP: Record<string, string> = {
  notransaksi: 'receiptNumber', nomortransaksi: 'receiptNumber', receiptnumber: 'receiptNumber', no: 'receiptNumber', number: 'receiptNumber', invoice: 'receiptNumber', nonota: 'receiptNumber',
  transactiontype: 'transactionType', jenisdokumen: 'transactionType', jenistransaksi: 'transactionType', type: 'transactionType',
  transactiondate: 'transactionDate', tanggal: 'transactionDate', date: 'transactionDate',
  transactiontime: 'transactionTime', jam: 'transactionTime', waktu: 'transactionTime', time: 'transactionTime',
  customername: 'customerName', customer: 'customerName', pelanggan: 'customerName', namapelanggan: 'customerName',
  profiliusaha: 'businessProfileName', profilusaha: 'businessProfileName', toko: 'businessProfileName', namatoko: 'businessProfileName', namausaha: 'businessProfileName', businessname: 'businessProfileName',
  customeraddress: 'customerAddress', alamat: 'customerAddress',
  businessprofileid: 'businessProfileId',
  description: 'description', keterangan: 'description',
  orientation: 'orientation', orientasi: 'orientation',
  papersize: 'paperSize', ukuran: 'paperSize', kertas: 'paperSize', ukurankertas: 'paperSize',
  discounttype: 'discountType', jenisdiskon: 'discountType',
  discountvalue: 'discountValue', diskon: 'discountValue', nilaidiskon: 'discountValue',
  taxtype: 'taxType', jenispajak: 'taxType', jenisppn: 'taxType',
  taxvalue: 'taxValue', pajak: 'taxValue', ppn: 'taxValue', nilaipajak: 'taxValue',
  paymentmethod: 'paymentMethod', pembayaran: 'paymentMethod', metodepembayaran: 'paymentMethod',
  paymentstatus: 'paymentStatus', status: 'paymentStatus', statuspembayaran: 'paymentStatus',
  notes: 'notes', catatan: 'notes',
  recipientname: 'recipientName', penerima: 'recipientName', namapenerima: 'recipientName',
  cashiername: 'cashierName', kasir: 'cashierName', operator: 'cashierName', namakasir: 'cashierName', kasiroperator: 'cashierName',
  fueltype: 'fuelType', jenisbbm: 'fuelType',
  volume: 'volume', liter: 'volume',
  priceperliter: 'pricePerLiter', hargaperliter: 'pricePerLiter', hargaliter: 'pricePerLiter',
  vehiclenumber: 'vehicleNumber', nopol: 'vehicleNumber', plat: 'vehicleNumber', kendaraan: 'vehicleNumber', nomorkendaraan: 'vehicleNumber',
  dispensernumber: 'dispenserNumber', dispenser: 'dispenserNumber', nozzle: 'dispenserNumber', nomordispenser: 'dispenserNumber',
  spbu: 'spbuId', idspbu: 'spbuId', spbuid: 'spbuId', nomorspbu: 'spbuId',
  namaspbu: 'spbuName', spbuname: 'spbuName',
  showdpp: 'showDpp', tampilkandpp: 'showDpp',
  dpplabel: 'dppLabel', labeldpp: 'dppLabel',
};

const ITEM_MAP: Record<string, keyof Item> = {
  name: 'name', namaitem: 'name', itemname: 'name', item: 'name', produk: 'name', product: 'name', nama: 'name',
  qty: 'quantity', quantity: 'quantity', jumlah: 'quantity', jumlahitem: 'quantity',
  harga: 'unitPrice', hargasatuan: 'unitPrice', unitprice: 'unitPrice', price: 'unitPrice', hargaperliter: 'unitPrice', hargaliter: 'unitPrice',
};

const NUMBER_FIELDS = new Set(['discountValue', 'taxValue', 'volume', 'pricePerLiter']);
const BOOLEAN_FIELDS = new Set(['showDpp']);
const DATE_FIELDS = new Set(['transactionDate']);
const TIME_FIELDS = new Set(['transactionTime']);

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const clean = String(value ?? '')
    .replace(/Rp|IDR/gi, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const result = Number(clean);
  return Number.isFinite(result) ? result : 0;
}

function toBoolean(value: unknown): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'ya' || text === 'yes' || text === 'on';
}

function toDate(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const parts = text.split(/[-/.]/);
  if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return text.slice(0, 10);
}

function toTime(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return /^\d{2}:\d{2}$/.test(text) ? `${text}:00` : text;
}

function toTransactionType(value: unknown): string {
  const text = keyOf(String(value ?? ''));
  if (text === 'fuel' || text === 'bbm' || text.includes('transaksibbm') || text.includes('bahanbakar')) return 'fuel';
  if (text === 'payment' || text.includes('pembayaran')) return 'payment';
  if (text === 'sale' || text === 'penjualan' || text.includes('strukpenjualan')) return 'sale';
  return 'receipt';
}

function toRateType(value: unknown): string {
  const text = keyOf(String(value ?? ''));
  if (text === 'percent' || text === 'persen' || text.includes('persen') || text === '%') return 'percent';
  if (text === 'amount' || text === 'nominal' || text.includes('nominal') || text.includes('rupiah')) return 'amount';
  return 'none';
}

function convert(key: string, value: unknown): unknown {
  if (key === 'transactionType') return toTransactionType(value);
  if (key === 'discountType' || key === 'taxType') return toRateType(value);
  if (NUMBER_FIELDS.has(key)) return toNumber(value);
  if (BOOLEAN_FIELDS.has(key)) return toBoolean(value);
  if (DATE_FIELDS.has(key)) return toDate(value);
  if (TIME_FIELDS.has(key)) return toTime(value);
  return String(value ?? '').trim();
}

/** Baca CSV (pemisah koma atau titik koma) menjadi array objek. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',' || char === ';') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const cleaned = rows.filter(cells => cells.some(cell => cell.trim()));
  if (cleaned.length < 2) return [];
  const headers = cleaned[0].map(header => header.trim());
  return cleaned.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function itemFrom(row: Record<string, unknown>, fallbackId: string): Item | null {
  const item: any = { id: fallbackId };
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = ITEM_MAP[keyOf(rawKey)];
    if (!key) continue;
    item[key] = key === 'name' ? String(rawValue ?? '').trim() : toNumber(rawValue);
  }
  if (!item.name) return null;
  return { id: item.id, name: item.name, quantity: item.quantity ?? 0, unitPrice: item.unitPrice ?? 0 };
}

function isItemRow(row: Record<string, unknown>): boolean {
  const keys = Object.keys(row).map(keyOf);
  return keys.some(key => key === 'name' || key === 'namaitem' || key === 'itemname' || key === 'item' || key === 'produk')
    && keys.some(key => key === 'qty' || key === 'quantity' || key === 'jumlah' || key === 'harga' || key === 'hargasatuan' || key === 'unitprice' || key === 'hargaperliter' || key === 'hargaliter');
}

function absorbMeta(target: Record<string, unknown>, row: Record<string, unknown>) {
  for (const [rawKey, rawValue] of Object.entries(row)) {
    if (rawValue === '' || rawValue === null || rawValue === undefined) continue;
    const key = KEY_MAP[keyOf(rawKey)];
    if (key) target[key] = convert(key, rawValue);
  }
}

/** Header kolom yang dikenali oleh normalizeImport. */
export const IMPORT_HEADERS = [
  'Jenis Dokumen', 'Profil Usaha', 'Nomor Transaksi', 'Tanggal', 'Jam', 'Nama Pelanggan', 'Alamat', 'Kasir / Operator',
  'ID SPBU', 'Nama SPBU', 'Jenis BBM', 'Volume', 'Harga / Liter', 'Nomor Kendaraan', 'Nomor Dispenser',
  'Nama Item', 'Qty', 'Harga Satuan', 'Jenis Diskon', 'Nilai Diskon', 'Jenis PPN', 'PPN',
  'Metode Pembayaran', 'Status Pembayaran', 'Catatan', 'Keterangan', 'Tampilkan DPP', 'Label DPP',
  'Orientasi', 'Ukuran Kertas',
];

type ImportProfile = string | { id?: string; businessName?: string };

const normalizeProfiles = (profiles: ImportProfile[] = []) => profiles.map(profile => typeof profile === 'string'
  ? { id: '', businessName: profile.trim() }
  : { id: String(profile.id || '').trim(), businessName: String(profile.businessName || '').trim() }
).filter(profile => profile.businessName || profile.id);

/** Bangun template Excel impor: sheet Transaksi, Profil Usaha, Contoh, dan Petunjuk. */
export async function buildImportTemplate(profiles: ImportProfile[] = []): Promise<Uint8Array<ArrayBuffer>> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const styleHeader = (worksheet: any) => {
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5148E5' } };
  };
  const profileList = normalizeProfiles(profiles);
  const profileValues = profileList.map(profile => profile.id || profile.businessName);
  const profileValue = profileValues[0] || 'Toko Contoh';

  const sheet = workbook.addWorksheet('Transaksi');
  sheet.addRow(IMPORT_HEADERS);
  styleHeader(sheet);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns = IMPORT_HEADERS.map(header => ({ width: Math.max(14, header.length + 2) }));

  const profileCol = sheet.getColumn(IMPORT_HEADERS.indexOf('Profil Usaha') + 1).letter;
  if (profileValues.length) {
    const list = `"${profileValues.map(value => String(value).replace(/"/g, '""').replace(/,/g, ';')).join(',')}"`;
    for (let row = 2; row <= 300; row++) {
      (sheet as any).dataValidations.add(`${profileCol}${row}`, { type: 'list', allowBlank: true, formulae: [list] });
    }
  }

  const profileSheet = workbook.addWorksheet('Profil Usaha');
  profileSheet.addRow(['ID Profil', 'Nama Usaha']);
  styleHeader(profileSheet);
  profileSheet.views = [{ state: 'frozen', ySplit: 1 }];
  profileSheet.columns = [{ width: 32 }, { width: 38 }];
  profileList.forEach(profile => profileSheet.addRow([profile.id, profile.businessName]));

  const example = workbook.addWorksheet('Contoh');
  example.addRow(IMPORT_HEADERS);
  example.addRow([
    'fuel', profileValue, 'BBM-001', '2026-11-18', '09:30', 'Umum', '', 'Operator 1', 'SPBU-12345',
    'SPBU Cibubur', 'Pertamax', 10, 15000, '', '01', 'Pertamax', 10, 15000, 'none', 0,
    'percent', 11, 'Tunai', 'Lunas', '', '', 'Ya', 'DPP', 'portrait', 'A4',
  ]);
  example.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Pertamax Tambahan', 2, 15000]);
  example.addRow(['receipt', profileValue, '', '2026-11-18', '', 'Budi', 'Jl. Merdeka 1', 'Kasir 1', '', '', '', '', '', '', '', 'Jasa Servis', 1, 250000, 'none', 0, 'percent', 11, 'Tunai', 'Lunas', '', '', 'Tidak', 'DPP', 'portrait', 'A4']);
  example.addRow(['payment', profileValue, '', '2026-11-18', '', 'PT Maju', 'Jl. Sudirman 2', 'Kasir 1', '', '', '', '', '', '', '', 'Pembayaran Invoice', 1, 500000, 'none', 0, 'none', 0, 'Transfer bank', 'Lunas', 'Pelunasan', '', 'Tidak', 'DPP', 'portrait', 'A4']);
  example.addRow(['sale', profileValue, '', '2026-11-18', '', 'Umum', '', 'Kasir 2', '', '', '', '', '', '', '', 'Produk A', 2, 50000, 'none', 0, 'none', 0, 'Tunai', 'Lunas', '', '', 'Tidak', 'DPP', 'portrait', 'Thermal 58mm']);
  example.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Produk B', 1, 75000]);
  styleHeader(example);
  if (profileValues.length) {
    const list = `"${profileValues.map(name => String(name).replace(/"/g, '""').replace(/,/g, ';')).join(',')}"`;
    for (let row = 2; row <= 7; row++) {
      (example as any).dataValidations.add(`${profileCol}${row}`, { type: 'list', allowBlank: true, formulae: [list] });
    }
  }

  const guide = workbook.addWorksheet('Petunjuk');
  guide.columns = [{ width: 28 }, { width: 90 }];
  guide.addRow(['Panduan', 'Isi sheet Transaksi. Satu transaksi bisa punya beberapa baris item; isi Nama Item/Qty/Harga Satuan di setiap baris, kolom transaksi cukup di baris pertama.']);
  guide.addRow(['Jenis Dokumen', 'receipt = Kwitansi umum, payment = Bukti pembayaran, sale = Struk penjualan, fuel = Transaksi BBM.']);
  guide.addRow(['Sheet Profil Usaha', 'Berisi ID Profil dan Nama Usaha. Salin ID Profil ke kolom Profil Usaha di sheet Transaksi.']);
  guide.addRow(['Profil Usaha', 'Isi dengan ID Profil dari sheet Profil Usaha (nama usaha juga masih diterima). Jika modal impor tidak memilih profil, isi kolom ini yang dipakai.']);
  guide.addRow(['Jenis Diskon / PPN', 'none = tanpa, percent = persen, amount = nominal Rp.']);
  guide.addRow(['Tampilkan DPP', 'Tidak atau Ya.']);
  guide.addRow(['Tanggal', 'YYYY-MM-DD atau DD-MM-YYYY.']);
  guide.addRow(['Jam', 'HH:MM atau HH:MM:SS.']);
  guide.addRow(['Nomor Transaksi', 'Hanya wajib untuk transaksi BBM.']);

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/**
 * Pecah baris menjadi beberapa transaksi. Baris yang punya kolom transaksi
 * (Jenis Dokumen, Nomor Transaksi, Tanggal, dll.) memulai transaksi baru;
 * baris item tanpa kolom transaksi menempel ke transaksi sebelumnya.
 */
function hasTransactionMeta(row: Record<string, unknown>): boolean {
  return Object.entries(row).some(([rawKey, rawValue]) =>
    rawValue !== '' && rawValue !== null && rawValue !== undefined && Boolean(KEY_MAP[keyOf(rawKey)]));
}

function splitTransactionRows(rows: Record<string, unknown>[]): Record<string, unknown>[][] {
  const groups: Record<string, unknown>[][] = [];
  let current: Record<string, unknown>[] | null = null;
  for (const row of rows) {
    if (!current || hasTransactionMeta(row)) {
      current = [];
      groups.push(current);
    }
    current.push(row);
  }
  return groups;
}

/**
 * Ubah JSON, object, array, atau CSV hasil impor menjadi beberapa draft
 * transaksi. Satu file boleh berisi banyak transaksi; setiap transaksi boleh
 * punya beberapa baris item.
 */
export function normalizeImports(input: unknown, profileId: string, profiles: Array<{ id: string; businessName: string }> = []): ReceiptDraft[] {
  if (typeof input === 'string') {
    return splitTransactionRows(parseCsv(input)).map(group => normalizeImport(group, profileId, profiles));
  }
  if (Array.isArray(input)) {
    const first = input[0];
    if (first && typeof first === 'object' && Array.isArray((first as any).items)) return [normalizeImport(input, profileId, profiles)];
    const rows = input.filter(row => row && typeof row === 'object') as Record<string, unknown>[];
    const groups = splitTransactionRows(rows);
    return groups.length ? groups.map(group => normalizeImport(group, profileId, profiles)) : [normalizeImport(input, profileId, profiles)];
  }
  return [normalizeImport(input, profileId, profiles)];
}

/**
 * Ubah JSON, object, array, atau CSV hasil impor menjadi draft transaksi.
 * Mendukung satu transaksi dengan beberapa item maupun baris CSV per item.
 */
export function normalizeImport(input: unknown, profileId: string, profiles: Array<{ id: string; businessName: string }> = []): ReceiptDraft {
  const meta: Record<string, any> = {};
  const items: Item[] = [];
  const addItem = (row: Record<string, unknown>) => {
    const item = itemFrom(row, crypto.randomUUID());
    if (item) items.push(item);
  };
  const absorbRow = (row: Record<string, unknown>) => {
    absorbMeta(meta, row);
    const nestedItems = row.items;
    if (Array.isArray(nestedItems)) nestedItems.forEach(value => {
      if (value && typeof value === 'object') addItem(value as Record<string, unknown>);
    });
    if (isItemRow(row)) addItem(row);
  };

  if (typeof input === 'string') {
    parseCsv(input).forEach(absorbRow);
  } else if (Array.isArray(input)) {
    const first = input[0];
    if (first && typeof first === 'object' && Array.isArray((first as any).items)) absorbRow(first as Record<string, unknown>);
    else input.forEach(row => { if (row && typeof row === 'object') absorbRow(row as Record<string, unknown>); });
  } else if (input && typeof input === 'object') {
    absorbRow(input as Record<string, unknown>);
  }

  if (!items.length) items.push({ id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0 });

  const wantedProfile = String(meta.businessProfileName ?? '').trim();
  const matchedProfile = profiles.find(profile => profile.id === wantedProfile || keyOf(profile.businessName) === keyOf(wantedProfile));

  const draft: ReceiptDraft = {
    receiptNumber: String(meta.receiptNumber ?? ''),
    transactionType: String(meta.transactionType || 'receipt'),
    transactionDate: String(meta.transactionDate || new Date().toISOString().slice(0, 10)),
    transactionTime: String(meta.transactionTime || ''),
    businessProfileId: String(matchedProfile?.id || meta.businessProfileId || profileId || ''),
    customerName: String(meta.customerName || 'Umum'),
    customerAddress: String(meta.customerAddress || ''),
    description: String(meta.description || ''),
    orientation: String(meta.orientation || 'portrait'),
    paperSize: String(meta.paperSize || 'A4'),
    items,
    discountType: String(meta.discountType || 'none'),
    discountValue: toNumber(meta.discountValue),
    dppLabel: String(meta.dppLabel || ''),
    showDpp: toBoolean(meta.showDpp),
    taxType: String(meta.taxType || 'none'),
    taxValue: toNumber(meta.taxValue),
    paymentMethod: String(meta.paymentMethod || 'Tunai'),
    paymentStatus: String(meta.paymentStatus || 'Lunas'),
    notes: String(meta.notes || ''),
    recipientName: String(meta.recipientName || ''),
    cashierName: String(meta.cashierName || ''),
    fuelType: String(meta.fuelType || ''),
    volume: toNumber(meta.volume),
    pricePerLiter: toNumber(meta.pricePerLiter),
    vehicleNumber: String(meta.vehicleNumber || ''),
    dispenserNumber: String(meta.dispenserNumber || ''),
    spbuId: String(meta.spbuId || ''),
    spbuName: String(meta.spbuName || ''),
  };
  return draft;
}