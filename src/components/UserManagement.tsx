'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Trash2, UserRound, Users, X } from 'lucide-react';

type ManagedUser = { id: string; name: string; email: string; role: 'owner' | 'staff'; createdAt: string };

export function UserManagement({ notify }: { notify: (message: string) => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Daftar pengguna gagal dimuat.');
      setUsers(data);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Daftar pengguna gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  function startEdit(user: ManagedUser) {
    setEditing(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setError('');
  }

  function clearForm() {
    setEditing(null);
    setName('');
    setEmail('');
    setPassword('');
    setError('');
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(editing ? `/api/users/${editing.id}` : '/api/users', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Data pengguna gagal disimpan.');
      await refresh();
      clearForm();
      notify(editing ? (password ? 'Data dan kata sandi pengguna diperbarui.' : 'Nama pengguna diperbarui.') : 'Pengguna staf berhasil ditambahkan.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Data pengguna gagal disimpan.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(user: ManagedUser) {
    if (!confirm(`Hapus akses ${user.name}? Pengguna ini tidak akan dapat login lagi.`)) return;
    const response = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      notify(data.error || 'Pengguna gagal dihapus.');
      return;
    }
    if (editing?.id === user.id) clearForm();
    await refresh();
    notify('Akses pengguna telah dihapus.');
  }

  const staffCount = users.filter(user => user.role === 'staff').length;

  return <div className="settings-grid user-management">
    <section className="card">
      <div className="sectionhead">
        <div><h2>Pengguna usaha</h2><p className="eyebrow">{staffCount} staf memiliki akses ke data usaha ini.</p></div>
        <span className="avatar"><Users size={17}/></span>
      </div>
      {loading ? <div className="empty">Memuat daftar pengguna…</div> : error && users.length === 0 ? <div className="notice">{error}</div> : users.length === 0 ? <div className="empty">Belum ada pengguna.</div> : <div className="tablewrap"><table className="data-table user-table"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Bergabung</th><th>Aksi</th></tr></thead><tbody>
        {users.map(user => <tr key={user.id}>
          <td><span className="user-name"><span className="user-avatar"><UserRound size={15}/></span><b>{user.name}</b></span></td>
          <td>{user.email}</td>
          <td><span className={`pill ${user.role === 'owner' ? 'owner-pill' : ''}`}>{user.role === 'owner' ? 'Pemilik' : 'Staf'}</span></td>
          <td>{new Date(user.createdAt).toLocaleDateString('id-ID')}</td>
          <td>{user.role === 'staff' ? <div className="inline"><button className="btn small" title="Edit pengguna" onClick={() => startEdit(user)}><Pencil size={14}/></button><button className="btn small danger" title="Hapus pengguna" onClick={() => void remove(user)}><Trash2 size={14}/></button></div> : <span className="muted">Akun Anda</span>}</td>
        </tr>)}
      </tbody></table></div>}
      <div className="notice">Staf dapat mengelola transaksi dan profil usaha bersama. Hanya pemilik yang dapat mengelola pengguna.</div>
    </section>

    <form className="card user-form" onSubmit={save}>
      <div className="sectionhead"><div><h2>{editing ? 'Edit pengguna staf' : 'Tambah pengguna staf'}</h2><p className="eyebrow">Buat akses untuk anggota tim usaha Anda.</p></div>{editing && <button type="button" className="btn small" title="Batal edit" onClick={clearForm}><X size={15}/></button>}</div>
      <div className="formgrid">
        <div className="field full"><label>Nama</label><input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Nama pengguna"/></div>
        {!editing && <div className="field full"><label>Email login</label><input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="nama@usaha.id"/></div>}
        <div className="field full"><label>{editing ? 'Kata sandi baru (opsional)' : 'Kata sandi awal'}</label><input required={!editing} type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder={editing ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'}/>{editing&&<small className="muted"><KeyRound size={12}/> Mengganti kata sandi akan mengeluarkan pengguna dari semua sesi.</small>}</div>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="inline" style={{marginTop:18}}><button className="btn primary" disabled={saving}><Plus size={15}/>{saving ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah pengguna'}</button>{editing&&<button type="button" className="btn" onClick={clearForm}>Batal</button>}</div>
    </form>
  </div>;
}
