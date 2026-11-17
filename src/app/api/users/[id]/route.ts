import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, hashPassword } from '@/lib/auth';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  if (session.role !== 'owner') return NextResponse.json({ error: 'Hanya pemilik usaha yang dapat mengubah pengguna.' }, { status: 403 });
  const { id } = await params;
  try {
    const data = await request.json();
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Nama harus terdiri dari 2–80 karakter.' }, { status: 400 });
    if (password && (password.length < 8 || password.length > 128)) return NextResponse.json({ error: 'Kata sandi baru harus terdiri dari 8–128 karakter.' }, { status: 400 });
    const target = await prisma.user.findFirst({ where: { id, ownerId: session.workspaceId }, select: { id: true } });
    if (!target) return NextResponse.json({ error: 'Pengguna staf tidak ditemukan.' }, { status: 404 });
    const updated = await prisma.user.update({
      where: { id },
      data: { name, ...(password ? { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } } : {}) },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Pengguna gagal diperbarui.', detail: String(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  if (session.role !== 'owner') return NextResponse.json({ error: 'Hanya pemilik usaha yang dapat menghapus pengguna.' }, { status: 403 });
  const { id } = await params;
  const deleted = await prisma.user.deleteMany({ where: { id, ownerId: session.workspaceId } });
  return deleted.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Pengguna staf tidak ditemukan.' }, { status: 404 });
}
