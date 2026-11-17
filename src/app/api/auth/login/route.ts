import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, setSessionCookie, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Email atau kata sandi tidak cocok.' }, { status: 401 });
    }
    const role = user.role === 'staff' ? 'staff' : 'owner';
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role, workspaceId: user.ownerId || user.id } });
    setSessionCookie(response, request, createSession({ userId: user.id, name: user.name, email: user.email, role, workspaceId: user.ownerId || user.id, sessionVersion: user.sessionVersion }));
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Login gagal.', detail: String(error) }, { status: 400 });
  }
}
