import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, hashPassword, readSession, verifyPassword } from '../src/lib/auth.ts';

process.env.AUTH_SECRET = 'test-session-secret-with-at-least-32-bytes-long';

test('kata sandi di-hash dan diverifikasi', async () => {
  const encoded = await hashPassword('rahasia-aman-123');
  assert.notEqual(encoded, 'rahasia-aman-123');
  assert.equal(await verifyPassword('rahasia-aman-123', encoded), true);
  assert.equal(await verifyPassword('sandi-yang-salah', encoded), false);
});

test('cookie sesi ditandatangani dan token yang berubah ditolak', () => {
  const token = createSession({ userId: 'user-1', email: 'akun@example.id', name: 'Pemilik' });
  const request = new Request('http://localhost/api/auth/session', { headers: { cookie: `invoiceapp_session=${token}` } });
  assert.deepEqual(readSession(request)?.userId, 'user-1');
  const changed = `${token.slice(0, 10)}${token[10] === 'a' ? 'b' : 'a'}${token.slice(11)}`;
  const changedRequest = new Request('http://localhost/api/auth/session', { headers: { cookie: `invoiceapp_session=${changed}` } });
  assert.equal(readSession(changedRequest), null);
});
