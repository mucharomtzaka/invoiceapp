import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { calculate } from '@/lib/calculations';
import { getSession } from '@/lib/auth';

const schema = z.object({
  receiptNumber: z.string().min(1), transactionType: z.string(), transactionDate: z.string(), transactionTime: z.string(),
  businessProfileId: z.string().nullable().optional(), customerName: z.string().default('Umum'),
  customerAddress: z.string().optional(), description: z.string().optional(), orientation: z.string(), paperSize: z.string(),
  items: z.array(z.object({ name: z.string().min(1), quantity: z.number().nonnegative(), unitPrice: z.number().nonnegative() })).min(1),
  discountType: z.string(), discountValue: z.number().nonnegative(), dppLabel: z.string().default('DPP'),
  taxType: z.string(), taxValue: z.number().nonnegative(), paymentMethod: z.string(), paymentStatus: z.string(),
  notes: z.string().optional(), recipientName: z.string().optional(), cashierName: z.string().optional(),
  fuelType: z.string().optional(), volume: z.number().optional(), pricePerLiter: z.number().optional(),
  vehicleNumber: z.string().optional(), dispenserNumber: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  try {
    const receipts = await prisma.receipt.findMany({
      where: { userId: session.workspaceId }, include: { items: true, businessProfile: true }, orderBy: { transactionDate: 'desc' },
    });
    return NextResponse.json(receipts);
  } catch (error) {
    return NextResponse.json({ error: 'Database belum siap', detail: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  try {
    const data = schema.parse(await request.json());
    if (data.discountType === 'percent' && data.discountValue > 100) {
      return NextResponse.json({ error: 'Diskon persen tidak boleh melebihi 100%.' }, { status: 400 });
    }
    const profile = data.businessProfileId
      ? await prisma.businessProfile.findFirst({ where: { id: data.businessProfileId, userId: session.workspaceId } })
      : await prisma.businessProfile.findFirst({ where: { userId: session.workspaceId, isDefault: true } });
    if (!profile) return NextResponse.json({ error: 'Profil usaha tidak ditemukan.' }, { status: 400 });
    const totals = calculate(data.items, data.discountType, data.discountValue, data.taxType, data.taxValue);
    const receipt = await prisma.receipt.create({
      data: {
        ...data, userId: session.workspaceId, businessProfileId: profile.id, transactionDate: new Date(data.transactionDate),
        subtotal: totals.subtotal, discountAmount: totals.discountAmount, dpp: totals.dpp,
        taxAmount: totals.taxAmount, total: totals.total,
        items: { create: data.items.map((item, index) => ({ ...item, subtotal: totals.itemTotals[index] })) },
      },
      include: { items: true, businessProfile: true },
    });
    return NextResponse.json(receipt);
  } catch (error) {
    return NextResponse.json({ error: 'Tidak dapat menyimpan transaksi', detail: String(error) }, { status: 400 });
  }
}
