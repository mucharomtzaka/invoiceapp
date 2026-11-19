import { NextResponse } from 'next/server';
import fs from 'node:fs';
import { getSession } from '@/lib/auth';
import { createDatabaseBackup } from '@/lib/sqlite-backup';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  if (session.role !== 'owner') return NextResponse.json({ error: 'Hanya pemilik yang dapat mencadangkan database.' }, { status: 403 });
  let backup = '';
  try {
    backup = await createDatabaseBackup();
    const buffer = fs.readFileSync(backup);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="invoiceapp-backup-${stamp}.db"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal membuat backup database.', detail: String(error) }, { status: 400 });
  } finally {
    if (backup) fs.rmSync(backup, { force: true });
  }
}
