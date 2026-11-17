import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  if (session.role !== 'owner') return NextResponse.json({ error: 'Hanya pemilik usaha yang dapat mengelola pengguna.' }, { status: 403 });
  const users = await prisma.user.findMany({
    where: { OR: [{ id: session.workspaceId }, { ownerId: session.workspaceId }] },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  if (session.role !== 'owner') return NextResponse.json({ error: 'Hanya pemilik usaha yang dapat menambahkan pengguna.' }, { status: 403 });
  try {
    const data = await request.json();
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Nama harus terdiri dari 2–80 karakter.' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: 'Masukkan alamat email yang valid.' }, { status: 400 });
    if (password.length < 8 || password.length > 128) return NextResponse.json({ error: 'Kata sandi harus terdiri dari 8–128 karakter.' }, { status: 400 });
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return NextResponse.json({ error: 'Email sudah digunakan.' }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: 'staff', ownerId: session.workspaceId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Pengguna gagal ditambahkan.', detail: String(error) }, { status: 400 });
  }
}
