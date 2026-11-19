'use client';
import { useMemo } from 'react';
import type { ReceiptDraft } from '@/lib/types';
import { buildReceiptText } from '@/lib/escpos';

/**
 * Struk thermal untuk pratinjau, cetak browser, dan PDF.
 * Memakai tata letak teks yang sama dengan perintah ESC/POS Bluetooth
 * supaya hasil cetak tetap tajam pada kertas 58 mm / 80 mm.
 */
export function ThermalReceipt({ data, business }: { data: ReceiptDraft; business: any }) {
  const width = data.paperSize.includes('80') ? 80 : 58;
  const text = useMemo(
    () => buildReceiptText(data, business, {
      width,
      copies: 1,
      showCustomer: true,
      showNotes: true,
      showFooter: true,
    }),
    [data, business, width],
  );
  return (
    <article className={`thermal-sheet${width === 80 ? ' wide' : ''}`} aria-label="Pratinjau struk thermal">
      {business?.logo && <img className="thermal-logo" src={business.logo} alt={`Logo ${business.businessName || 'usaha'}`} />}
      <pre>{text}</pre>
    </article>
  );
}
