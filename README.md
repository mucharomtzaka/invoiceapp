# Kwitansi Pro

Aplikasi web berbahasa Indonesia untuk membuat dan mengelola kwitansi, bukti pembayaran, struk penjualan, serta transaksi BBM. Nominal menggunakan Rupiah. Data transaksi dan profil disimpan secara persisten di SQLite melalui Prisma.

## Teknologi

- Next.js App Router, React, TypeScript
- Prisma ORM 7, adapter `better-sqlite3`, dan SQLite (`prisma/dev.db`)
- ExcelJS untuk ekspor `.xlsx`
- Zod untuk validasi payload API
- Lucide React untuk ikon
- Web Bluetooth + WebUSB + ESC/POS untuk cetak thermal langsung (tanpa dependensi tambahan)

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

- Dashboard dengan ringkasan transaksi, grafik tren penjualan 7/30 hari, distribusi status pembayaran, dan nilai per metode pembayaran, serta transaksi terbaru.
- Form kwitansi, bukti pembayaran, struk penjualan, serta transaksi BBM.
- Item jamak, kuantitas pecahan, diskon dan PPN persen atau nominal, dan ringkasan otomatis.
- Preview dokumen formal A4/A5 portrait/landscape dan thermal 58/80 mm.
- Print dialog browser untuk cetak dan simpan sebagai PDF.
- Cetak struk thermal langsung ke printer Bluetooth LE atau USB (ESC/POS 58 mm/80 mm) dari editor transaksi maupun riwayat.
- Simpan, edit, hapus, cari, filter tanggal/status, pilih, dan cetak ulang transaksi.
- Ekspor Excel satu transaksi dan banyak transaksi, termasuk angka numerik, filter, freeze header, dan total laporan.
- Laporan dengan rentang tanggal, profil usaha multi-usaha, serta preset template cetak.
- Manajemen pengguna oleh pemilik: tambah staf, ubah nama/kata sandi, hapus akses, dan berbagi data workspace.

## Cetak dan PDF

Pilih ukuran kertas di editor, lalu tekan **Cetak / PDF**. Di dialog browser, pilih printer fisik atau **Save as PDF**. Untuk thermal, atur ukuran kertas 58 mm atau 80 mm di preferensi printer/driver, margin minimal, skala 100%, dan matikan header/footer browser jika opsi tersedia. Browser mengatur jumlah salinan melalui dialog cetak.

Pada ukuran **Thermal 58 mm** dan **Thermal 80 mm**, pratinjau, **Cetak / PDF**, dan cetak Bluetooth memakai tata letak teks monospace yang sama (32/48 kolom, nominal rata kanan, garis pemisah teks). Tampilan thermal tidak lagi memakai tabel HTML, sehingga hasil cetak/PDF lebih tajam dan tidak terpotong. PDF mengikuti ukuran halaman thermal yang dipilih; pastikan skala cetak 100% agar lebar baris tetap pas.

Tombol **Cetak / PDF** untuk struk (editor maupun detail transaksi) mencetak lewat permukaan cetak khusus: hanya salinan struk yang dikirim ke printer, sedangkan sidebar, panel form, modal, dan sisa layout halaman disembunyikan. Ukuran halaman juga diatur saat mencetak — A4/A5 mengikuti ukuran kertas, sedangkan thermal 58/80 mm memakai tinggi struk sebenarnya. Hasilnya selalu **satu lembar** untuk satu struk, tanpa halaman kedua yang kosong. Jika struk memang lebih panjang dari satu halaman A4/A5, isinya akan berlanjut ke halaman berikutnya secara wajar.

### Cetak thermal Bluetooth

Tombol **Cetak thermal** di pratinjau dokumen (dan pada detail transaksi di riwayat) membuka panel cetak thermal langsung. Pilih tab **Bluetooth**:

1. Nyalakan printer thermal dan aktifkan Bluetooth-nya (mode BLE/Bluetooth LE). Pada Windows, pasangkan (pair) printer lebih dulu melalui **Pengaturan → Bluetooth & perangkat**.
2. Tekan **Hubungkan**, lalu pilih printer pada dialog pemilih perangkat.
3. Pilih lebar kertas 58 mm (32 kolom) atau 80 mm (48 kolom), jumlah salinan, potong kertas, dan opsi tampilan.
4. Tekan **Cetak struk**. Data dikirim sebagai perintah ESC/POS dalam potongan kecil agar printer tidak kelebihan buffer. Gunakan tombol **Tes** untuk memastikan jalur cetak bekerja sebelum mencetak transaksi.

Fitur ini memakai Web Bluetooth, jadi perlu Chrome/Edge versi terbaru melalui HTTPS atau `localhost`, maupun aplikasi desktop InvoiceApp. Printer harus mendukung ESC/POS dan Bluetooth LE; printer klasik yang hanya menyediakan Bluetooth SPP tidak terdeteksi oleh Web Bluetooth.

Jika muncul **“GATT operation failed for unknown reason”**:
- Pasangkan printer di pengaturan Bluetooth sistem operasi, lalu hubungkan ulang dari aplikasi.
- Pilih **Ukuran paket data → Aman · 20 byte** (default) dan **Metode kirim → Tanpa konfirmasi**, kemudian coba lagi.
- Jauhkan ponsel/komputer dari gangguan sinyal dan dekatkan printer.
- Jika printer hanya mendukung satu metode tulis, coba **Dengan konfirmasi**. Setelah berhasil, ukuran paket boleh dinaikkan (100/180 byte) agar lebih cepat.
- Pada macOS, izinkan akses Bluetooth saat aplikasi desktop pertama kali meminta.

### Cetak thermal USB

Pilih tab **USB** pada panel cetak thermal, lalu tekan **Hubungkan** dan pilih printer pada dialog pemilih perangkat.

1. Nyalakan printer dan sambungkan kabel USB **data** (bukan kabel charger).
2. Tekan **Hubungkan**. Di Chrome/Edge, dialog pemilih perangkat bawaan browser akan muncul. Di aplikasi desktop, daftar printer tampil langsung di panel.
3. Jika printer tidak muncul (deskriptor USB tidak standar), tekan **Tampilkan semua perangkat USB** untuk memunculkan dialog pemilih dengan seluruh perangkat USB yang terpasang.
4. Pilih lebar kertas 58/80 mm dan opsi tampilan, lalu tekan **Tes** atau **Cetak struk**.

Jalur USB memakai WebUSB dan mengirim perintah ESC/POS langsung ke endpoint bulk OUT printer, jadi tidak memerlukan driver printer di aplikasi desktop. Ukuran transfer default 1 KB; turunkan ke **Aman · 64 byte** jika printer menghentikan transfer atau hasil cetak terputus.

Catatan kompatibilitas:
- Perangkat yang ditampilkan mencakup kelas Printer (7), printer vendor-specific (0xff), dan vendor printer thermal umum seperti Epson, Bixolon, Star, Zebra, Xprinter, dan Rongta.
- Jika printer tidak muncul, tutup aplikasi atau driver printer lain yang sedang memakai perangkat, lalu hubungkan ulang.
- **Windows:** WebUSB memerlukan driver WinUSB untuk perangkat tersebut. Bila printer memakai driver pabrikan, gunakan tombol **Cetak / PDF**.
- **Linux:** pastikan aturan udev mengizinkan Chromium mengakses perangkat USB.
- **macOS:** umumnya tidak perlu driver tambahan untuk printer ESC/POS.

#### Izin USB di Windows

Windows tidak memiliki dialog izin USB seperti izin kamera. Pada Chrome/Edge, langkah izinnya adalah **dialog pemilih perangkat** yang muncul setelah tombol **Hubungkan** ditekan; pada aplikasi desktop, pemilih itu tampil di dalam panel aplikasi. Jadi tidak ada pop-up izin terpisah yang bisa dimunculkan. Bila dialog pemilih tidak muncul karena printer tidak cocok dengan filter, gunakan **Tampilkan semua perangkat USB**.

Jika perangkat sudah dipilih tetapi muncul pesan **“Sistem menolak membuka perangkat USB”** (Chromium: `SecurityError: Access denied`), penyebabnya adalah driver perangkat, bukan izin yang belum diklik:

1. Buka **Device Manager**, cari printer di bagian **Universal Serial Bus devices** atau **Print queues**.
2. Ganti driver antarmuka printer ke **WinUSB** memakai [Zadig](https://zadig.akeo.ie/) (pilih perangkat → **WinUSB** → *Replace Driver*). Ini mengganti driver antarmuka, bukan driver printer untuk mencetak dari Windows.
3. Cabut dan sambungkan ulang printer, lalu tekan **Hubungkan** lagi.
4. Jika driver pabrikan tetap diperlukan untuk aplikasi lain, gunakan tombol **Cetak / PDF** untuk mencetak lewat driver tersebut.

Panel cetak menampilkan **Detail teknis** di bawah pesan galat agar nama dan pesan galat asli Chromium bisa dibaca saat menelusuri masalah izin/driver.

Logo raster dan barcode belum didukung pada jalur ESC/POS, baik Bluetooth maupun USB; keduanya tetap tampil pada cetak browser/PDF.

## Catatan implementasi

PPN nominal mengikuti nominal yang dimasukkan pengguna. PDF dibuat dari dokumen HTML yang sama dengan tampilan cetak menggunakan dialog browser. Jalur cetak thermal Bluetooth dan USB memakai mesin hitung yang sama dengan pratinjau/PDF sehingga nominal selalu konsisten. Pilihan upload logo pada struk thermal ESC/POS, tanda tangan digital, backup otomatis, dan integrasi printer jaringan langsung belum tersedia.
