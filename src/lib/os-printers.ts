export type OsPrinter = {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  width: 58 | 80 | null;
  thermal: boolean;
};

type Bridge = { listPrinters?: () => Promise<OsPrinter[]> };

/** Daftar printer OS beserta lebar kertas terdeteksi (aplikasi desktop saja). */
export async function listOsPrinters(): Promise<OsPrinter[]> {
  const bridge = (globalThis as { desktopBridge?: Bridge }).desktopBridge;
  if (!bridge?.listPrinters) return [];
  try {
    const printers = await bridge.listPrinters();
    return Array.isArray(printers) ? printers : [];
  } catch {
    return [];
  }
}
