import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildImportTemplate, normalizeImport, normalizeImports, parseCsv } from '../src/lib/import.ts';

test('import JSON with camelCase keys', () => {
  const json = {
    receiptNumber: 'BBM123',
    transactionType: 'fuel',
    transactionDate: '2025-10-01',
    transactionTime: '14:30:00',
    businessProfileId: 'profile-1',
    customerName: 'Andi',
    customerAddress: 'Jl. Raya',
    orientation: 'portrait',
    paperSize: 'Thermal 80mm',
    items: [
      { name: 'BBM', quantity: 1, unitPrice: 150000 },
      { name: 'Oil', quantity: 2, unitPrice: 30000 },
    ],
    discountType: 'none',
    discountValue: 0,
    taxType: 'none',
    taxValue: 0,
    paymentMethod: 'Tunai',
    paymentStatus: 'Lunas',
    notes: 'Test import',
    description: 'Test import',
    fuelType: 'Pertalite',
    volume: 10,
    pricePerLiter: 15000,
    vehicleNumber: 'B 1234 AB',
    dispenserNumber: 'P 01',
    spbuId: 'SPBU-001',
    spbuName: 'Stasiun BBM',
    showDpp: true,
  };
  const draft = normalizeImport(json, 'any');
  assert.strictEqual(draft.receiptNumber, 'BBM123');
  assert.strictEqual(draft.transactionType, 'fuel');
  assert.strictEqual(draft.fuelType, 'Pertalite');
  assert.strictEqual(draft.spbuId, 'SPBU-001');
  assert.strictEqual(draft.spbuName, 'Stasiun BBM');
  assert.strictEqual(draft.volume, 10);
  assert.strictEqual(draft.pricePerLiter, 15000);
  assert.strictEqual(draft.showDpp, true);
  // items
  const itemNames = draft.items.map(i => i.name);
  assert.deepStrictEqual(itemNames, ['BBM', 'Oil']);
});

test('import CSV supports fuel meta and item columns', () => {
  const csv = 'Jenis Dokumen,Nomor Transaksi,Tanggal,Jam,Nama Pelanggan,ID SPBU,Nama SPBU,Jenis BBM,Volume,Harga/Liter,Kendaraan,Nama Item,Qty,Harga Satuan\nfuel,BBM-1,18-11-2026,09:30,Andi,SPBU-001,SPBU Cibubur,Pertalite,10,15000,B 1 A,Pertalite,10,15000';
  assert.equal(parseCsv(csv).length, 1);
  const draft = normalizeImport(csv, 'profile-1');
  assert.strictEqual(draft.transactionType, 'fuel');
  assert.strictEqual(draft.receiptNumber, 'BBM-1');
  assert.strictEqual(draft.transactionDate, '2026-11-18');
  assert.strictEqual(draft.transactionTime, '09:30:00');
  assert.strictEqual(draft.customerName, 'Andi');
  assert.strictEqual(draft.spbuId, 'SPBU-001');
  assert.strictEqual(draft.spbuName, 'SPBU Cibubur');
  assert.strictEqual(draft.fuelType, 'Pertalite');
  assert.strictEqual(draft.volume, 10);
  assert.strictEqual(draft.pricePerLiter, 15000);
  assert.strictEqual(draft.vehicleNumber, 'B 1 A');
  assert.strictEqual(draft.items.length, 1);
  assert.strictEqual(draft.items[0].name, 'Pertalite');
  assert.strictEqual(draft.items[0].quantity, 10);
  assert.strictEqual(draft.items[0].unitPrice, 15000);
});

test('import CSV merges multiple item rows into one transaction', () => {
  const csv = 'Jenis Dokumen,Nomor Transaksi,Nama Item,Qty,Harga Satuan\nfuel,BBM-2,Produk A,1,1000\n,,Produk B,2,2000';
  const draft = normalizeImport(csv, 'profile-1', []);
  assert.strictEqual(draft.transactionType, 'fuel');
  assert.strictEqual(draft.receiptNumber, 'BBM-2');
  assert.strictEqual(draft.items.length, 2);
  assert.strictEqual(draft.items[0].name, 'Produk A');
  assert.strictEqual(draft.items[1].name, 'Produk B');
  assert.strictEqual(draft.items[1].quantity, 2);
});

test('import resolves business profile by name', () => {
  const draft = normalizeImport({ 'Jenis Dokumen': 'receipt', 'Profil Usaha': 'Toko Kedua' }, 'default', [
    { id: 'first', businessName: 'Toko Pertama' },
    { id: 'second', businessName: 'Toko Kedua' },
  ]);
  assert.strictEqual(draft.businessProfileId, 'second');
});

test('template Excel has sheets, headers, and a valid fuel example', async () => {
  const buffer = await buildImportTemplate();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepStrictEqual(workbook.worksheets.map(sheet => sheet.name), ['Transaksi', 'Profil Usaha', 'Contoh', 'Petunjuk']);

  const headers = workbook.getWorksheet('Transaksi').getRow(1).values.slice(1);
  for (const header of ['Jenis Dokumen', 'Profil Usaha', 'Nomor Transaksi', 'ID SPBU', 'Nama SPBU', 'Nama Item', 'Tampilkan DPP']) {
    assert.ok(headers.includes(header), `header ${header} missing`);
  }

  const example = workbook.getWorksheet('Contoh');
  const exampleHeaders = example.getRow(1).values.slice(1);
  const exampleRows = rowNumbers => rowNumbers.map(rowNumber => {
    const values = example.getRow(rowNumber).values.slice(1);
    return Object.fromEntries(exampleHeaders.map((header, index) => [header, values[index]]));
  });
  const profiles = [{ id: 'contoh', businessName: 'Toko Contoh' }];

  const fuel = normalizeImport(exampleRows([2, 3]), 'profile-1', profiles);
  assert.strictEqual(fuel.transactionType, 'fuel');
  assert.strictEqual(fuel.businessProfileId, 'contoh');
  assert.strictEqual(fuel.fuelType, 'Pertamax');
  assert.strictEqual(fuel.vehicleNumber, '');
  assert.strictEqual(fuel.spbuId, 'SPBU-12345');
  assert.strictEqual(fuel.spbuName, 'SPBU Cibubur');
  assert.strictEqual(fuel.showDpp, true);
  assert.strictEqual(fuel.items.length, 2);

  assert.strictEqual(normalizeImport(exampleRows([4]), 'profile-1', profiles).transactionType, 'receipt');
  assert.strictEqual(normalizeImport(exampleRows([5]), 'profile-1', profiles).transactionType, 'payment');
  const sale = normalizeImport(exampleRows([6, 7]), 'profile-1', profiles);
  assert.strictEqual(sale.transactionType, 'sale');
  assert.strictEqual(sale.items.length, 2);

  const all = normalizeImports(exampleRows([2, 3, 4, 5, 6, 7]), 'profile-1', profiles);
  assert.deepStrictEqual(all.map(draft => draft.transactionType), ['fuel', 'receipt', 'payment', 'sale']);
  assert.deepStrictEqual(all.map(draft => draft.items.length), [2, 1, 1, 2]);
});

test('template Excel lists business profiles as a dropdown by id', async () => {
  const buffer = await buildImportTemplate([
    { id: 'toko-satu', businessName: 'Toko Satu' },
    { id: 'toko-dua', businessName: 'Toko Dua' },
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet('Transaksi');
  const validation = sheet.getCell('B2').dataValidation;
  assert.strictEqual(validation.type, 'list');
  assert.match(validation.formulae[0], /toko-satu/);
  assert.match(validation.formulae[0], /toko-dua/);
  assert.strictEqual(workbook.getWorksheet('Contoh').getCell('B2').value, 'toko-satu');

  const profiles = workbook.getWorksheet('Profil Usaha');
  assert.deepStrictEqual(profiles.getRow(1).values.slice(1), ['ID Profil', 'Nama Usaha']);
  assert.deepStrictEqual(profiles.getRow(2).values.slice(1), ['toko-satu', 'Toko Satu']);
  assert.deepStrictEqual(profiles.getRow(3).values.slice(1), ['toko-dua', 'Toko Dua']);
});

test('import resolves business profile by id from Profil Usaha column', () => {
  const draft = normalizeImport({ 'Profil Usaha': 'toko-dua' }, 'default', [
    { id: 'toko-satu', businessName: 'Toko Satu' },
    { id: 'toko-dua', businessName: 'Toko Dua' },
  ]);
  assert.strictEqual(draft.businessProfileId, 'toko-dua');
});

test('import CSV splits multiple transactions and keeps each item list', () => {
  const csv = [
    'Jenis Dokumen,Nomor Transaksi,Nama Item,Qty,Harga Satuan',
    'fuel,BBM-9,Pertamax,5,15000',
    ',,Pertamax Tambahan,1,15000',
    'receipt,,Jasa Servis,1,250000',
    'sale,,Produk A,2,50000',
    ',,Produk B,1,75000',
  ].join('\n');
  const drafts = normalizeImports(csv, 'profile-1', []);
  assert.deepStrictEqual(drafts.map(draft => draft.transactionType), ['fuel', 'receipt', 'sale']);
  assert.deepStrictEqual(drafts.map(draft => draft.items.map(item => item.name)), [
    ['Pertamax', 'Pertamax Tambahan'],
    ['Jasa Servis'],
    ['Produk A', 'Produk B'],
  ]);
  assert.strictEqual(drafts[0].receiptNumber, 'BBM-9');
});