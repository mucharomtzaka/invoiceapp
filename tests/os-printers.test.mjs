import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { detectPaperWidth } = require('../desktop/printers.cjs');

test('deteksi lebar dari nama printer', () => {
  assert.equal(detectPaperWidth({ name: 'EPSON TM-T82 80mm' }), 80);
  assert.equal(detectPaperWidth({ displayName: 'Xprinter XP-58IIL 58 mm' }), 58);
});

test('deteksi lebar dari opsi driver', () => {
  assert.equal(detectPaperWidth({ options: { 'media-size': 'om_58mm_roll' } }), 58);
  assert.equal(detectPaperWidth({ options: { paperWidth: 80000 } }), 80);
  assert.equal(detectPaperWidth({ options: { 'media-width': '58' } }), 58);
});

test('abaikan printer non-thermal', () => {
  assert.equal(detectPaperWidth({ name: 'HP LaserJet 1020', options: { dpi: '600' } }), null);
});
