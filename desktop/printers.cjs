'use strict';

// Deteksi lebar kertas printer OS (58 mm / 80 mm) dari nama printer dan
// opsi driver. Electron hanya memberi nama + opsi platform-specific, jadi
// pencocokan dilakukan dengan beberapa pola yang umum dipakai driver thermal.

const MM_PATTERN = /(?<!\d)(58|80)(?!\d)\s*mm/i;

function scanMicrons(value) {
  const match = /^\d{4,6}$/.exec(String(value).trim());
  if (!match) return null;
  const microns = Number(match[0]);
  if (microns >= 48000 && microns <= 62000) return 58;
  if (microns >= 70000 && microns <= 88000) return 80;
  return null;
}

function scanMillimeters(value) {
  const match = /^\d{1,3}(?:\.\d+)?$/.exec(String(value).trim());
  if (!match) return null;
  const mm = Number(match[0]);
  if (mm >= 52 && mm <= 62) return 58;
  if (mm >= 72 && mm <= 88) return 80;
  return null;
}

/**
 * @param {{ name?: string, displayName?: string, description?: string, options?: Record<string, unknown> }} printer
 * @returns {58 | 80 | null}
 */
function detectPaperWidth(printer) {
  if (!printer) return null;
  const labels = [printer.name, printer.displayName, printer.description].filter(Boolean);
  const labelText = labels.join(' ');

  const labelMatch = MM_PATTERN.exec(labelText);
  if (labelMatch) return Number(labelMatch[1]);

  // Opsi yang biasanya menyimpan ukuran kertas (CUPS: media, media-size,
  // paper-width; Windows: paperSize, PaperSize, dsb.).
  for (const [key, raw] of Object.entries(printer.options || {})) {
    if (!/(paper|media|width|size)/i.test(key)) continue;
    const value = String(raw ?? '');
    const textMatch = MM_PATTERN.exec(value);
    if (textMatch) return Number(textMatch[1]);
    const width = scanMicrons(value) ?? scanMillimeters(value);
    if (width) return width;
  }

  return null;
}

function isThermal(printer, width) {
  if (width) return true;
  const text = [printer?.name, printer?.displayName, printer?.description].filter(Boolean).join(' ');
  return /thermal|receipt|struk|kasir|pos\b|esc\/pos|58\s*mm|80\s*mm/i.test(text);
}

/**
 * @param {import('electron').WebContents} webContents
 */
async function listPrinters(webContents) {
  const printers = await webContents.getPrintersAsync();
  return printers.map(printer => {
    const width = detectPaperWidth(printer);
    return {
      name: printer.name,
      displayName: printer.displayName || printer.name,
      description: printer.description || '',
      isDefault: Boolean(printer.isDefault),
      width,
      thermal: isThermal(printer, width),
    };
  });
}

module.exports = { detectPaperWidth, listPrinters };
