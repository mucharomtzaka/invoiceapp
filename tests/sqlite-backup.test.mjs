import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { createDatabaseBackup, databasePath, validateSqliteDatabase, REQUIRED_TABLES } from '../src/lib/sqlite-backup.ts';

const original = process.env.DATABASE_URL;
const restoreEnv = () => { if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original; };

async function withTempDb(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kwitansi-'));
  const dbPath = path.join(dir, 'test.db');
  const db = new Database(dbPath);
  try {
    for (const table of REQUIRED_TABLES) {
      db.exec(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY)`);
    }
    process.env.DATABASE_URL = `file:${dbPath}`;
    try { await fn(); } finally { restoreEnv(); }
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('databasePath strips file prefix and resolves', () => {
  process.env.DATABASE_URL = 'file:/tmp/kwitansi.db';
  assert.strictEqual(databasePath(), path.resolve('/tmp/kwitansi.db'));
  restoreEnv();
});

test('createDatabaseBackup produces a file', async () => {
  await withTempDb(async () => {
    const backup = await createDatabaseBackup();
    assert.ok(fs.existsSync(backup));
    const stats = fs.statSync(backup);
    assert.ok(stats.size > 0);
    validateSqliteDatabase(backup);
    fs.rmSync(backup);
  });
});

test('validateSqliteDatabase accepts valid DB', async () => {
  await withTempDb(() => {
    validateSqliteDatabase(databasePath());
  });
});

test('validateSqliteDatabase rejects missing tables', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kwitansi-'));
  const dbPath = path.join(dir, 'empty.db');
  const db = new Database(dbPath);
  db.exec('CREATE TABLE Dummy (id TEXT PRIMARY KEY)');
  db.close();
  assert.throws(() => validateSqliteDatabase(dbPath), /Database backup tidak memiliki tabel/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('validateSqliteDatabase rejects invalid SQLite file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kwitansi-'));
  const invalid = path.join(dir, 'invalid.db');
  fs.writeFileSync(invalid, 'not sqlite');
  assert.throws(() => validateSqliteDatabase(invalid), /bukan database SQLite yang valid/);
  fs.rmSync(dir, { recursive: true, force: true });
});
