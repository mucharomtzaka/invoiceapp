import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  const { id } = await params;
  try {
    const profile = await prisma.businessProfile.findFirst({ where: { id, userId: session.workspaceId } });
    if (!profile) return NextResponse.json({ error: 'Profil tidak ditemukan.' }, { status: 404 });
    const used = await prisma.receipt.count({ where: { businessProfileId: id, userId: session.workspaceId } });
    if (used) return NextResponse.json({ error: 'Profil ini masih digunakan transaksi dan tidak dapat dihapus.' }, { status: 409 });
    await prisma.$transaction(async (tx) => {
      await tx.businessProfile.delete({ where: { id } });
      if (profile.isDefault) {
        const next = await tx.businessProfile.findFirst({ where: { userId: session.workspaceId }, orderBy: { businessName: 'asc' } });
        if (next) await tx.businessProfile.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menghapus profil usaha.', detail: String(error) }, { status: 400 });
  }
}
