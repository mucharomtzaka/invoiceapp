import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, hashPassword, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Nama harus terdiri dari 2–80 karakter.' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: 'Masukkan alamat email yang valid.' }, { status: 400 });
    if (password.length < 8 || password.length > 128) return NextResponse.json({ error: 'Kata sandi harus terdiri dari 8–128 karakter.' }, { status: 400 });
    const passwordHash = await hashPassword(password);
    const registration = await prisma.$transaction(async (tx) => {
      if (await tx.user.findUnique({ where: { email } })) return { duplicate: true as const };
      const firstAccount = (await tx.user.count()) === 0;
      const user = await tx.user.create({ data: { name, email, passwordHash } });
      if (firstAccount) {
        await tx.receipt.updateMany({ where: { userId: null }, data: { userId: user.id } });
        await tx.businessProfile.updateMany({ where: { userId: null }, data: { userId: user.id } });
        await tx.printTemplate.updateMany({ where: { userId: null }, data: { userId: user.id } });
      }
      return { user };
    });
    if ('duplicate' in registration) return NextResponse.json({ error: 'Email sudah terdaftar.' }, { status: 409 });
    const { user } = registration;

    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: 'owner', workspaceId: user.id } }, { status: 201 });
    setSessionCookie(response, request, createSession({ userId: user.id, name: user.name, email: user.email, role: 'owner', workspaceId: user.id }));
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Registrasi gagal.', detail: String(error) }, { status: 400 });
  }
}
