import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';

export const REQUIRED_TABLES = ['User', 'Receipt', 'ReceiptItem', 'BusinessProfile', 'PrintTemplate'];

export function databasePath(): string {
  const url = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const database = url.replace(/^file:/, '').split('?')[0];
  return path.resolve(database);
}

export function validateSqliteDatabase(file: string): void {
  if (!fs.existsSync(file)) throw new Error('File backup tidak ditemukan.');
  const size = fs.statSync(file).size;
  if (size < 512) throw new Error('File backup bukan database SQLite yang valid.');
  const header = Buffer.alloc(16);
  const descriptor = fs.openSync(file, 'r');
  try {
    fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (!header.equals(Buffer.from('SQLite format 3\0', 'binary'))) throw new Error('File backup bukan database SQLite yang valid.');
  const database = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const integrity = database.pragma('integrity_check', { simple: true });
    if (String(integrity).toLowerCase() !== 'ok') throw new Error('Database backup gagal validasi integrity check.');
    const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row: any) => String(row.name)));
    const missing = REQUIRED_TABLES.filter((table) => !tables.has(table));
    if (missing.length) throw new Error(`Database backup tidak memiliki tabel ${missing.join(', ')}.`);
  } finally {
    database.close();
  }
}

export async function createDatabaseBackup(): Promise<string> {
  const source = databasePath();
  if (!fs.existsSync(source)) throw new Error('Database saat ini tidak ditemukan.');
  const target = path.join(os.tmpdir(), `invoiceapp-backup-${randomBytes(6).toString('hex')}.db`);
  const database = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await database.backup(target);
  } finally {
    database.close();
  }
  return target;
}
