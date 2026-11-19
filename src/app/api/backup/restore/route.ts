import { NextResponse } from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { databasePath, validateSqliteDatabase } from '@/lib/sqlite-backup';

export const runtime = 'nodejs';

const MAX_BACKUP_SIZE = 100 * 1024 * 1024;
let restoreQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = restoreQueue.then(task, task);
  restoreQueue = next.then(() => undefined, () => undefined);
  return next;
}

export async function POST(request: Request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Silakan login.' }, { status: 401 });
  if (session.role !== 'owner') return NextResponse.json({ error: 'Hanya pemilik yang dapat memulihkan database.' }, { status: 403 });

  return enqueue(async () => {
    let upload = '';
    try {
      const form = await request.formData();
      if (String(form.get('confirm') || '') !== 'RESTORE') {
        return NextResponse.json({ error: 'Ketik RESTORE untuk mengonfirmasi.' }, { status: 400 });
      }
      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'File backup wajib dipilih.' }, { status: 400 });
      if (!file.size) return NextResponse.json({ error: 'File backup kosong.' }, { status: 400 });
      if (file.size > MAX_BACKUP_SIZE) return NextResponse.json({ error: 'Ukuran file backup maksimal 100 MB.' }, { status: 400 });

      upload = path.join(os.tmpdir(), `invoiceapp-restore-${randomBytes(6).toString('hex')}.db`);
      fs.writeFileSync(upload, Buffer.from(await file.arrayBuffer()));
      validateSqliteDatabase(upload);

      const target = databasePath();
      const rollback = `${target}.before-restore`;
      fs.mkdirSync(path.dirname(target), { recursive: true });

      await prisma.$disconnect();
      try {
        if (fs.existsSync(target)) fs.copyFileSync(target, rollback);
        for (const suffix of ['-wal', '-shm']) fs.rmSync(`${target}${suffix}`, { force: true });
        fs.copyFileSync(upload, target);
        await prisma.$connect();
      } catch (error) {
        try {
          if (fs.existsSync(rollback)) fs.copyFileSync(rollback, target);
          await prisma.$connect();
        } catch {
          // Keep the original error; the backup file remains on disk for manual recovery.
        }
        throw error;
      }

      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: 'Gagal memulihkan database.', detail: String(error) }, { status: 400 });
    } finally {
      if (upload) fs.rmSync(upload, { force: true });
    }
  });
}
