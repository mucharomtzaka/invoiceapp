import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrinterTest,
  buildReceiptEscPos,
  buildReceiptText,
  padLine,
  thermalColumns,
  thermalMoney,
  toAscii,
  wrapText,
} from '../src/lib/escpos.ts';

const business = {
  businessName: 'Toko Sinar Jaya',
  address: 'Jl. Merdeka No. 10, Bandung',
  phone: '0812-3456-7890',
};

const draft = {
  receiptNumber: 'KW-20261118-001',
  transactionType: 'receipt',
  transactionDate: '2026-11-18',
  transactionTime: '09:30:15',
  businessProfileId: 'profile-1',
  customerName: 'Budi',
  customerAddress: '',
  description: '',
  orientation: 'portrait',
  paperSize: 'Thermal 58mm',
  items: [
    { id: '1', name: 'Produk A', quantity: 2, unitPrice: 100000 },
    { id: '2', name: 'Produk B', quantity: 1, unitPrice: 150000 },
  ],
  discountType: 'percent',
  discountValue: 10,
  dppLabel: 'DPP',
  taxType: 'percent',
  taxValue: 11,
  paymentMethod: 'Tunai',
  paymentStatus: 'Lunas',
  notes: '',
  recipientName: '',
  cashierName: 'Admin',
  fuelType: '',
  volume: 0,
  pricePerLiter: 0,
  vehicleNumber: '',
  dispenserNumber: '',
};

function decode(bytes) {
  return Array.from(bytes, byte => String.fromCharCode(byte)).join('');
}

test('lebar kolom thermal 58 mm dan 80 mm', () => {
  assert.equal(thermalColumns(58), 32);
  assert.equal(thermalColumns(80), 48);
});

test('teks struk memakai nominal dan total yang sama dengan mesin hitung', () => {
  const text = buildReceiptText(draft, business, { width: 58 });
  assert.match(text, /KW-20261118-001/);
  assert.match(text, /Toko Sinar Jaya/);
  assert.match(text, /Subtotal\s+Rp350\.000/);
  assert.match(text, /Diskon\s+-Rp35\.000/);
  assert.match(text, /DPP\s+Rp315\.000/);
  assert.match(text, /PPN 11%\s+Rp34\.650/);
  assert.match(text, /TOTAL\s+Rp349\.650/);
  assert.match(text, /18-11-2026/);
  assert.match(text, /TERIMA KASIH/);
});

test('setiap baris struk tidak melebihi lebar kertas', () => {
  for (const width of [58, 80]) {
    const text = buildReceiptText(draft, business, { width });
    for (const line of text.split('\n')) {
      assert.ok(line.length <= thermalColumns(width), `baris ${JSON.stringify(line)} terlalu panjang untuk ${width} mm`);
    }
  }
  const wide = buildReceiptText(draft, business, { width: 80 });
  assert.ok(wide.split('\n').some(line => line.length === 48));
});

test('item dengan nama panjang dibungkus otomatis', () => {
  const longName = 'Jasa pemasangan jaringan internet dan konfigurasi perangkat kantor';
  const data = { ...draft, items: [{ id: '1', name: longName, quantity: 1, unitPrice: 500000 }] };
  const text = buildReceiptText(data, business, { width: 58 });
  const itemLines = text.split('\n').filter(line => line.length > 0);
  assert.ok(itemLines.every(line => line.length <= 32));
  assert.ok(text.includes('Jasa pemasangan jaringan'));
});

test('ESC/POS diawali inisialisasi dan diakhiri perintah potong', () => {
  const bytes = buildReceiptEscPos(draft, business, { width: 58, cut: true });
  assert.deepEqual(Array.from(bytes.slice(0, 2)), [0x1b, 0x40]);
  const tail = Array.from(bytes.slice(-4));
  assert.deepEqual(tail, [0x1d, 0x56, 0x42, 0x00]);
  assert.match(decode(bytes), /KW-20261118-001/);
});

test('jumlah salinan menggandakan isi dan potong dapat dimatikan', () => {
  const three = buildReceiptEscPos(draft, business, { width: 58, copies: 3 });
  const text = decode(three);
  assert.equal(text.split('KW-20261118-001').length - 1, 3);

  const noCut = buildReceiptEscPos(draft, business, { width: 58, cut: false });
  assert.equal(decode(noCut).includes(String.fromCharCode(0x1d, 0x56, 0x42, 0x00)), false);
});

test('transaksi BBM menampilkan detail bahan bakar', () => {
  const fuel = {
    ...draft,
    transactionType: 'fuel',
    receiptNumber: 'BBM-20261118-001',
    items: [{ id: '1', name: 'Pertamax', quantity: 20, unitPrice: 12000 }],
    fuelType: 'Pertamax',
    volume: 20,
    pricePerLiter: 12000,
    vehicleNumber: 'B 1234 XYZ',
    dispenserNumber: '03',
  };
  const text = buildReceiptText(fuel, business, { width: 58 });
  assert.match(text, /BUKTI PEMBELIAN BBM/);
  assert.match(text, /Jenis BBM/);
  assert.match(text, /Pertamax/);
  assert.match(text, /Volume\s+: 20 Liter/);
  assert.match(text, /Kendaraan\s+: B 1234 XYZ/);
});

test('kuantitas pecahan tampil tanpa pembulatan', () => {
  const data = { ...draft, items: [{ id: '1', name: 'Solar', quantity: 20.5, unitPrice: 12000 }] };
  const text = buildReceiptText(data, business, { width: 58 });
  assert.match(text, /20,5 x Rp12\.000/);
  assert.match(text, /Rp246\.000/);
});

test('opsi tampilan dapat menyembunyikan pelanggan, catatan, dan footer', () => {
  const data = { ...draft, notes: 'Simpan struk ini' };
  const text = buildReceiptText(data, business, {
    width: 58,
    showCustomer: false,
    showNotes: false,
    showFooter: false,
  });
  assert.equal(text.includes('Pelanggan'), false);
  assert.equal(text.includes('Catatan'), false);
  assert.equal(text.includes('TERIMA KASIH'), false);
});

test('perintah tes printer berisi teks diagnostik dan potong kertas', () => {
  const bytes = buildPrinterTest();
  assert.deepEqual(Array.from(bytes.slice(0, 2)), [0x1b, 0x40]);
  assert.match(decode(bytes), /TES PRINTER/);
  assert.match(decode(bytes), /Koneksi Bluetooth OK/);
  assert.deepEqual(Array.from(bytes.slice(-4)), [0x1d, 0x56, 0x42, 0x00]);
});

test('format nominal ringkas tanpa spasi khusus', () => {
  assert.equal(thermalMoney(349650), 'Rp349.650');
  assert.equal(thermalMoney(0), 'Rp0');
});

test('toAscii membersihkan karakter yang tidak didukung printer', () => {
  assert.equal(toAscii('“Halo” – Rp\u00a0×\u00e9'), '"Halo" - Rp xe');
  assert.equal(toAscii('Café Señor'), 'Cafe Senor');
});

test('wrapText dan padLine menjaga lebar kolom', () => {
  assert.deepEqual(wrapText('satu dua tiga empat', 10), ['satu dua', 'tiga empat']);
  assert.equal(padLine('Subtotal', 'Rp350.000', 32).length, 32);
  const squeezed = padLine('Nama item yang sangat panjang sekali', 'Rp1.000.000', 32);
  assert.equal(squeezed.length, 32);
  assert.ok(squeezed.endsWith('Rp1.000.000'));
});
