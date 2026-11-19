'use client';
import { useRef, useState } from 'react';
import { DatabaseBackup, Download, Upload } from 'lucide-react';

export function BackupRestore({ notify }: { notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const input = useRef<HTMLInputElement>(null);

  async function download() {
    setBusy(true);
    try {
      const response = await fetch('/api/backup');
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Gagal membuat backup database.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoiceapp-backup-${new Date().toISOString().slice(0, 10)}.db`;
      link.click();
      URL.revokeObjectURL(url);
      notify('Backup database berhasil diunduh.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Gagal membuat backup database.');
    } finally {
      setBusy(false);
    }
  }

  async function restore(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return notify('Pilih file backup terlebih dahulu.');
    if (confirmation !== 'RESTORE') return notify('Ketik RESTORE untuk mengonfirmasi pemulihan.');
    if (!window.confirm('Restore akan MENGGANTI seluruh data saat ini dengan isi file backup. Tindakan ini tidak dapat dibatalkan. Lanjutkan?')) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('confirm', confirmation);
      const response = await fetch('/api/backup/restore', { method: 'POST', body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Gagal memulihkan database.');
      notify('Database berhasil dipulihkan. Halaman akan dimuat ulang.');
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Gagal memulihkan database.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="card" style={{ gridColumn: '1/-1' }}>
    <div className="sectionhead">
      <div>
        <h2><DatabaseBackup size={17} style={{ verticalAlign: '-3px', marginRight: 6 }} />Backup & restore database</h2>
        <p className="eyebrow" style={{ marginTop: 5 }}>Unduh salinan database sebelum melakukan perubahan besar. Restore mengganti seluruh data yang ada.</p>
      </div>
      <button type="button" className="btn" onClick={download} disabled={busy}><Download size={15} /> Unduh backup</button>
    </div>
    <form onSubmit={restore} className="inline" style={{ flexWrap: 'wrap', gap: 10 }}>
      <input
        ref={input}
        type="file"
        accept=".db,.sqlite,.sqlite3,application/x-sqlite3"
        onChange={event => { setFile(event.target.files?.[0] || null); setConfirmation(''); }}
        style={{ display: 'none' }}
      />
      <button type="button" className="btn" onClick={() => input.current?.click()} disabled={busy}><Upload size={15} /> Pilih file backup</button>
      <span className="muted" style={{ minWidth: 160 }}>{file ? file.name : 'Belum ada file dipilih'}</span>
      <input
        value={confirmation}
        onChange={event => setConfirmation(event.target.value)}
        placeholder="Ketik RESTORE"
        aria-label="Konfirmasi restore"
        style={{ maxWidth: 180 }}
        disabled={busy}
      />
      <button className="btn danger" disabled={busy || !file || confirmation !== 'RESTORE'}>{busy ? 'Memproses…' : 'Restore database'}</button>
    </form>
  </div>;
}
