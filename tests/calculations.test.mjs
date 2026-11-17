import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, terbilang } from '../src/lib/calculations.ts';

test('subtotal menjumlahkan banyak item dan pembulatan rupiah per item', () => {
  const result = calculate([{ quantity: 2, unitPrice: 100000 }, { quantity: 1, unitPrice: 150000 }], 'none', 0, 'none', 0);
  assert.equal(result.subtotal, 350000);
  assert.deepEqual(result.itemTotals, [200000, 150000]);
  assert.equal(result.total, 350000);
});

test('diskon persentase dan PPN persentase memakai DPP', () => {
  const result = calculate([{ quantity: 1, unitPrice: 350000 }], 'percent', 10, 'percent', 11);
  assert.equal(result.discountAmount, 35000);
  assert.equal(result.dpp, 315000);
  assert.equal(result.taxAmount, 34650);
  assert.equal(result.total, 349650);
});

test('diskon dan PPN nominal rupiah', () => {
  const result = calculate([{ quantity: 2, unitPrice: 50000 }], 'amount', 12000, 'amount', 5000);
  assert.equal(result.subtotal, 100000);
  assert.equal(result.discountAmount, 12000);
  assert.equal(result.dpp, 88000);
  assert.equal(result.taxAmount, 5000);
  assert.equal(result.total, 93000);
});

test('diskon dibatasi subtotal dan nilai negatif tidak membuat total negatif', () => {
  const result = calculate([{ quantity: 1, unitPrice: 1000 }], 'amount', 5000, 'none', 0);
  assert.equal(result.discountAmount, 1000);
  assert.equal(result.total, 0);
  assert.equal(calculate([{ quantity: -2, unitPrice: -3 }], 'none', -1, 'none', -1).total, 0);
});

test('terbilang rupiah', () => {
  assert.equal(terbilang(349650), 'tiga ratus empat puluh sembilan ribu enam ratus lima puluh rupiah');
});
