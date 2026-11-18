'use client';
import type { ReceiptDraft } from '@/lib/types';
import { DocumentPreview } from './DocumentPreview';
import { ThermalReceipt } from './ThermalReceipt';

/** Pilih tampilan dokumen sesuai ukuran kertas, termasuk jalur thermal teks. */
export function ReceiptPaper({ data, business }: { data: ReceiptDraft; business: any }) {
  if (data.paperSize.startsWith('Thermal')) return <ThermalReceipt data={data} business={business} />;
  return <DocumentPreview data={data} business={business} />;
}
