# Kwitansi Pro

Aplikasi web berbahasa Indonesia untuk membuat dan mengelola kwitansi, bukti pembayaran, struk penjualan, serta transaksi BBM. Nominal menggunakan Rupiah. Data transaksi dan profil disimpan secara persisten di SQLite melalui Prisma.

## Teknologi

- Next.js App Router, React, TypeScript
- Prisma ORM 7, adapter `better-sqlite3`, dan SQLite (`prisma/dev.db`)
- ExcelJS untuk ekspor `.xlsx`
- Zod untuk validasi payload API
- Lucide React untuk ikon

## Menjalankan aplikasi

Persyaratan: Node.js 20 atau lebih baru dan npm.

```bash
npm install
npx prisma generate
npm run db:push
npm run dev
```

Buka `http://localhost:3000`. Variabel `DATABASE_URL` ada di `.env` dan secara default memakai SQLite lokal (`file:./prisma/dev.db`). Untuk build production jalankan `npm run build`, lalu `npm start`. Port server production dapat diatur lewat `PORT` di `.env` (default `3000`); `APP_HOST` mengatur alamat bind.

## Akun pengguna

Halaman awal menyediakan registrasi dan login email/kata sandi. Kata sandi disimpan sebagai hash scrypt, sesi memakai cookie HTTP-only selama tujuh hari, dan sesi dicabut setelah pengguna dihapus atau kata sandinya direset. Akun terdaftar memiliki peran pemilik. Pemilik dapat membuat akun staf dari halaman **Manajemen pengguna**; staf berbagi transaksi, profil usaha, dan template workspace pemilik, sedangkan hanya pemilik yang dapat mengelola akun. Akun pertama mengambil alih data lokal lama yang belum memiliki pemilik. `AUTH_SECRET` wajib berisi nilai acak minimal 32 byte untuk deployment web; atur melalui `.env` berdasarkan `.env.example`. Aplikasi desktop membuat rahasia sesi lokal di direktori data aplikasi dan memperbarui kolom akun yang diperlukan saat dibuka.

## Aplikasi desktop

Shell desktop memakai Electron dan menjalankan Next.js di server lokal loopback. Database desktop disimpan terpisah di direktori data pengguna OS. Jalankan `npm run desktop:dev` untuk membuka aplikasi web di jendela Electron saat pengembangan.

Build installer macOS (DMG) dengan `npm run build:desktop` atau `npm run build:desktop:mac`. Target tambahan tersedia melalui `npm run build:desktop:windows` (NSIS) dan `npm run build:desktop:linux` (AppImage); jalankan build pada OS target untuk hasil yang paling stabil. Installer dibuat di folder `release/`. Build Windows menghasilkan installer **x64 untuk Windows 10 (versi 1809 atau lebih baru) dan Windows 11**. Build Windows x64 paling andal dijalankan di Windows karena native SQLite dan NSIS. Cross-build Windows dari macOS/Linux memerlukan prebuild native yang tersedia, cache npm yang dapat ditulis, serta Wine (Electron Builder mengunduh toolset Wine secara otomatis bila belum ada). Build macOS saat ini tidak ditandatangani/notarized; distribusi publik memerlukan sertifikat Developer ID Apple.

Jika aplikasi desktop gagal dibuka, log startup ditulis ke `%APPDATA%\InvoiceApp\logs\main.log` di Windows dan `~/Library/Application Support/InvoiceApp/logs/main.log` di macOS. Kirimkan isi berkas tersebut saat melaporkan masalah.

Untuk membangun ulang installer setelah mengubah schema, build menjalankan Prisma generate, build Next.js, dan membuat database template kosong yang disalin ke data pengguna pada peluncuran pertama. Data yang sudah ada tidak ditimpa saat aplikasi diperbarui.

## Deploy ke VPS

Panduan deployment umum Ubuntu/Debian tersedia di [docs/deployment-vps.md](docs/deployment-vps.md). Jika VPS dikelola dengan aaPanel dan aplikasi memakai domain, ikuti [docs/deployment-aapanel.md](docs/deployment-aapanel.md). Keduanya mencakup Node.js production, SQLite persisten, HTTPS, backup, dan pengaturan port melalui `PORT`; jangan jalankan `next dev` di VPS.

## Database

Schema berada di `prisma/schema.prisma`; URL koneksi Prisma 7 dikonfigurasi melalui `prisma.config.ts`.

- `Receipt` menyimpan transaksi, ringkasan perhitungan, pembayaran, format kertas, dan metadata BBM.
- `ReceiptItem` menyimpan item dengan relasi cascade ke transaksi.
- `BusinessProfile` menyimpan banyak identitas usaha; setiap transaksi menyimpan profil usaha yang dipakai untuk dokumennya.
- `PrintTemplate` menyimpan preset pengaturan cetak.
- `User` menyimpan akun, peran (`owner`/`staff`), workspace pemilik, dan versi sesi untuk pencabutan sesi. Transaksi, profil, dan template memakai ID pemilik workspace sehingga dapat digunakan bersama oleh staf.

Jalankan `npm run db:push` setelah mengubah schema. Database lokal berada di `prisma/dev.db`; cadangkan file tersebut untuk backup. Prisma Client terhubung melalui adapter SQLite `better-sqlite3`.

## Struktur folder

```text
src/app/                 Halaman Next.js, CSS, dan API routes
src/app/api/receipts/    CRUD transaksi
src/app/api/settings/    Profil usaha dan daftar template
src/app/api/templates/   Pembuatan preset cetak
src/components/          Editor transaksi dan pratinjau dokumen
src/lib/                 Prisma client, tipe data, dan mesin hitung
prisma/schema.prisma     Model database
design.md                Spesifikasi produk
```

## Fitur yang tersedia

- Dashboard dengan ringkasan transaksi dan transaksi terbaru.
- Form kwitansi, bukti pembayaran, struk penjualan, serta transaksi BBM.
- Item jamak, kuantitas pecahan, diskon dan PPN persen atau nominal, dan ringkasan otomatis.
- Preview dokumen formal A4/A5 portrait/landscape dan thermal 58/80 mm.
- Print dialog browser untuk cetak dan simpan sebagai PDF.
- Simpan, edit, hapus, cari, filter tanggal/status, pilih, dan cetak ulang transaksi.
- Ekspor Excel satu transaksi dan banyak transaksi, termasuk angka numerik, filter, freeze header, dan total laporan.
- Laporan dengan rentang tanggal, profil usaha multi-usaha, serta preset template cetak.
- Manajemen pengguna oleh pemilik: tambah staf, ubah nama/kata sandi, hapus akses, dan berbagi data workspace.

## Cetak dan PDF

Pilih ukuran kertas di editor, lalu tekan **Cetak / PDF**. Di dialog browser, pilih printer fisik atau **Save as PDF**. Untuk thermal, atur ukuran kertas 58 mm atau 80 mm di preferensi printer/driver, margin minimal, skala 100%, dan matikan header/footer browser jika opsi tersedia. Browser mengatur jumlah salinan melalui dialog cetak. Printer USB/Bluetooth langsung belum diintegrasikan; aplikasi menggunakan dialog cetak standar.

## Catatan implementasi

PPN nominal mengikuti nominal yang dimasukkan pengguna. PDF dibuat dari dokumen HTML yang sama dengan tampilan cetak menggunakan dialog browser. Pilihan upload logo, tanda tangan digital, backup otomatis, dan integrasi printer langsung belum tersedia.
