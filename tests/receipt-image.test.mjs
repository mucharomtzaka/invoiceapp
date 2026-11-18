import { test } from 'node:test';
import assert from 'node:assert/strict';
import { receiptImageLayout } from '../src/lib/receipt-image.ts';

test('layout gambar struk: lebar, tinggi, dan jumlah baris', () => {
  const layout = receiptImageLayout('ABC\nDEF\n', 32, 2, 3, 10, 22, 16);
  // teks 2 baris, 2 salinan dipisah 2 baris kosong, lalu 3 baris feed
  assert.deepEqual(layout.lines, ['ABC', 'DEF', '', '', 'ABC', 'DEF', '', '', '']);
  assert.equal(layout.width, 32 * 10 + 16 * 2);
  assert.equal(layout.height, layout.lines.length * 22 + 16 * 2);
});
