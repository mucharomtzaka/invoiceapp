import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma.ts';

const scrypt = (password: string, salt: Buffer, length: number) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, length, { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derived) => {
    if (error) reject(error);
    else resolve(derived as Buffer);
  });
});
export const SESSION_COOKIE = 'invoiceapp_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = { userId: string; email: string; name: string; role: 'owner' | 'staff'; workspaceId: string; sessionVersion: number; exp: number };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || Buffer.byteLength(value) < 32) throw new Error('AUTH_SECRET harus berisi minimal 32 byte.');
  return value;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [saltHex, hashHex] = encoded.split(':');
  if (!saltHex || !hashHex || !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSession(user: { userId: string; email: string; name: string; role?: string; workspaceId?: string; sessionVersion?: number }) {
  const payload: SessionUser = {
    userId: user.userId, email: user.email, name: user.name,
    role: user.role === 'staff' ? 'staff' : 'owner', workspaceId: user.workspaceId || user.userId,
    sessionVersion: user.sessionVersion || 0,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function readSession(request: Request): SessionUser | null {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  try {
    const expected = createHmac('sha256', secret()).update(encoded).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionUser;
    if (!payload.userId || !payload.email || !payload.name || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { ...payload, role: payload.role === 'staff' ? 'staff' : 'owner', workspaceId: payload.workspaceId || payload.userId, sessionVersion: payload.sessionVersion || 0 };
  } catch {
    return null;
  }
}

export async function getSession(request: Request): Promise<SessionUser | null> {
  const signed = readSession(request);
  if (!signed) return null;
  const user = await prisma.user.findUnique({
    where: { id: signed.userId },
    select: { id: true, email: true, name: true, role: true, ownerId: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== signed.sessionVersion) return null;
  return {
    ...signed,
    email: user.email,
    name: user.name,
    role: user.role === 'staff' ? 'staff' : 'owner',
    workspaceId: user.ownerId || user.id,
  };
}

export function setSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }, request: Request, token: string) {
  const secure = request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:';
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
}

export function clearSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }, request: Request) {
  const secure = request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:';
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 0 });
}
