/**
 * Cetak struk melalui permukaan cetak khusus (`#print-root`).
 *
 * Hanya salinan struk yang dimasukkan ke `#print-root` yang ikut tercetak.
 * Sisa layout aplikasi (sidebar, modal, `.app{min-height:100vh}`, tabel
 * laporan, dan elemen `position:fixed`) disembunyikan lewat CSS
 * `body.print-receipt`, sehingga tidak ada lagi lembar kedua yang kosong.
 *
 * Ukuran halaman juga diatur ulang saat mencetak:
 * - A4/A5 memakai ukuran standar (portrait/landscape).
 * - Thermal 58/80 mm memakai tinggi struk sebenarnya, bukan tinggi kertas
 *   bawaan printer, supaya PDF struk tidak terpotong atau bersisa.
 */

const MM_PER_PX = 25.4 / 96;

function ensureRoot(): HTMLElement {
  let root = document.getElementById('print-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'print-root';
    document.body.appendChild(root);
  }
  return root;
}

function ensurePageStyle(): HTMLStyleElement {
  let style = document.getElementById('print-page-size') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'print-page-size';
    document.head.appendChild(style);
  }
  return style;
}

function isThermal(sheet: Element): boolean {
  return sheet.classList.contains('thermal-sheet');
}

function pageRuleFor(sheet: Element): string {
  if (isThermal(sheet)) {
    const width = sheet.classList.contains('wide') ? 80 : 58;
    const measured = Math.ceil((sheet.getBoundingClientRect().height * MM_PER_PX) + 4);
    const height = Math.min(1000, Math.max(40, measured));
    return `@page{size:${width}mm ${height}mm;margin:0}`;
  }
  const paper = sheet.classList.contains('a5') ? 'A5' : 'A4';
  const orientation = sheet.classList.contains('landscape') ? ' landscape' : ' portrait';
  return `@page{size:${paper}${orientation};margin:0}`;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitForAssets(node: Element): Promise<void> {
  const tasks: Array<Promise<unknown>> = [];
  if ('fonts' in document) tasks.push(document.fonts.ready.catch(() => undefined));
  for (const image of Array.from(node.querySelectorAll('img'))) {
    if (image.complete) continue;
    tasks.push(new Promise<void>(resolve => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    }));
  }
  if (tasks.length) await Promise.race([Promise.all(tasks), wait(1200)]);
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

/**
 * Cetak struk yang sedang tampil. `source` adalah elemen `.paper` atau
 * `.thermal-sheet`; bila tidak ditemukan, jatuh kembali ke `window.print()`.
 */
export async function printReceipt(source: Element | null | undefined): Promise<void> {
  if (!source) {
    window.print();
    return;
  }

  const root = ensureRoot();
  const pageStyle = ensurePageStyle();
  // Bersihkan sisa permukaan cetak dari percobaan sebelumnya.
  root.className = '';
  root.replaceChildren();
  pageStyle.textContent = '';
  document.body.classList.remove('print-receipt');

  const cleanup = () => {
    document.body.classList.remove('print-receipt');
    root.replaceChildren();
    pageStyle.textContent = '';
    window.removeEventListener('afterprint', cleanup);
  };

  try {
    const clone = source.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach(node => node.remove());
    clone.removeAttribute('id');

    // Ukur tinggi struk thermal pada layout layar (lebar dan font sama dengan
    // hasil cetak) sebelum elemen dimasukkan ke permukaan cetak.
    root.className = 'measuring';
    root.replaceChildren(clone);
    void clone.getBoundingClientRect().height;
    pageStyle.textContent = pageRuleFor(clone);
    root.className = '';

    document.body.classList.add('print-receipt');
    // Konten dibiarkan sampai dialog cetak ditutup agar pratinjau browser
    // tetap berisi struk (Chrome dapat membuka pratinjau secara asinkron).
    window.addEventListener('afterprint', cleanup);

    await waitForAssets(clone);
    await nextFrame();
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}

/** Cetak struk terdekat dari tombol yang ditekan (editor atau modal detail). */
export function printReceiptFrom(trigger: Element): void {
  const scope = trigger.closest('.receipt-modal')
    ?? trigger.closest('.preview-wrap')
    ?? document.querySelector('.preview-wrap');
  const sheet = scope?.querySelector('.paper, .thermal-sheet');
  void printReceipt(sheet);
}
