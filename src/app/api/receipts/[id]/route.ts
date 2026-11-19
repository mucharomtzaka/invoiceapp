import { NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { calculate } from '@/lib/calculations';
import { getSession } from '@/lib/auth';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  const { id } = await params;
  const receipt = await prisma.receipt.findFirst({ where: { id, userId: session.workspaceId }, include: { items: true, businessProfile: true } });
  return receipt ? NextResponse.json(receipt) : NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 });
}

export async function PUT(request: Request, { params }: Context) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  const { id } = await params;
  try {
    const data = await request.json();
    if (!Number.isFinite(data.discountValue) || data.discountValue < 0 || !Number.isFinite(data.taxValue) || data.taxValue < 0) {
      return NextResponse.json({ error: 'Diskon dan PPN harus berupa nilai nol atau positif.' }, { status: 400 });
    }
    if (data.transactionType === 'fuel' && !String(data.receiptNumber || '').trim()) {
      return NextResponse.json({ error: 'Nomor transaksi BBM wajib diisi.' }, { status: 400 });
    }
    if (data.discountType === 'percent' && data.discountValue > 100) {
      return NextResponse.json({ error: 'Diskon persen tidak boleh melebihi 100%.' }, { status: 400 });
    }
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.some((item: any) =>
      !item.name || !Number.isFinite(item.quantity) || item.quantity < 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) {
      return NextResponse.json({ error: 'Minimal satu item valid harus diisi.' }, { status: 400 });
    }
    const profile = data.businessProfileId
      ? await prisma.businessProfile.findFirst({ where: { id: data.businessProfileId, userId: session.workspaceId } })
      : await prisma.businessProfile.findFirst({ where: { userId: session.workspaceId, isDefault: true } });
    if (!profile) return NextResponse.json({ error: 'Profil usaha tidak ditemukan.' }, { status: 400 });
    const totals = calculate(data.items, data.discountType, data.discountValue, data.taxType, data.taxValue);
    const updateData = {
      receiptNumber: data.receiptNumber, transactionType: data.transactionType,
      transactionDate: new Date(data.transactionDate), transactionTime: data.transactionTime || '',
      businessProfileId: profile.id, customerName: data.customerName || 'Umum',
      customerAddress: data.customerAddress || null, description: data.description || null,
      orientation: data.orientation, paperSize: data.paperSize,
      subtotal: totals.subtotal, discountType: data.discountType, discountValue: data.discountValue,
      discountAmount: totals.discountAmount, dppLabel: data.dppLabel || 'DPP', showDpp: Boolean(data.showDpp), dpp: totals.dpp,
      taxType: data.taxType, taxValue: data.taxValue, taxAmount: totals.taxAmount, total: totals.total,
      paymentMethod: data.paymentMethod, paymentStatus: data.paymentStatus, notes: data.notes || null,
      recipientName: data.recipientName || null, cashierName: data.cashierName || null,
      fuelType: data.fuelType || null, volume: data.volume || null, pricePerLiter: data.pricePerLiter || null,
      vehicleNumber: data.vehicleNumber || null, dispenserNumber: data.dispenserNumber || null,
      spbuId: data.spbuId || null, spbuName: data.spbuName || null,
    };
    const receipt = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const owned = await tx.receipt.findFirst({ where: { id, userId: session.workspaceId } });
      if (!owned) return null;
      await tx.receiptItem.deleteMany({ where: { receiptId: id } });
      return tx.receipt.update({
        where: { id }, data: { ...updateData, items: { create: data.items.map((item: any, index: number) => ({
          name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: totals.itemTotals[index],
        })) } }, include: { items: true, businessProfile: true },
      });
    });
    return receipt ? NextResponse.json(receipt) : NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal memperbarui transaksi.', detail: String(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  const { id } = await params;
  try {
    const result = await prisma.receipt.deleteMany({ where: { id, userId: session.workspaceId } });
    return result.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Transaksi tidak ditemukan.' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus transaksi.' }, { status: 400 });
  }
}
