import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const user = await getSession(request);
  const hasAccounts = (await prisma.user.count()) > 0;
  return NextResponse.json({ user: user ? { id: user.userId, name: user.name, email: user.email, role: user.role, workspaceId: user.workspaceId } : null, hasAccounts });
}
