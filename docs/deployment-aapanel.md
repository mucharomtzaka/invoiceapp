# Deploy Kwitansi Pro di aaPanel dengan domain

Panduan ini untuk aaPanel pada VPS Linux dengan Nginx dan SQLite. aaPanel saat ini mengelola app Node.js dari menu **Node.js Project**; domain dapat dihubungkan melalui **Mapping** dan SSL dikelola setelah mapping aktif. Nama menu dapat sedikit berbeda antarversi aaPanel. Lihat [dokumentasi Node.js Project aaPanel](https://www.aapanel.com/docs/Function/Node.html).

## 1. Arahkan domain ke VPS

Di pengelola DNS, buat record `A` untuk domain utama dan, bila dipakai, `www` yang mengarah ke IP publik VPS. Tunggu sampai DNS mengarah ke server. Buka port **80** dan **443** pada firewall aaPanel dan firewall provider VPS; jangan buka port aplikasi **3000** ke publik.

## 2. Pasang runtime dan siapkan direktori

Di aaPanel, buka **App Store** dan pasang **Node.js Project** (serta Node.js Version Manager jika belum tersedia). Dari Node.js Version Manager, pasang Node.js **22 atau lebih baru** dan pilih runtime tersebut sebagai versi command line. better-sqlite3 13 memerlukan Node.js 22+.

Di **Files**, buat direktori project `/www/wwwroot/kwitansi` dan direktori database `/www/server/kwitansi-data`. Unggah source project ke direktori project, termasuk `package-lock.json`, tetapi jangan unggah folder `node_modules` dari Mac/Windows. Atur pemilik direktori project dan database ke user `www`, yang umum dipakai sebagai run user di aaPanel.

Pastikan user `www` dapat menulis ke direktori database. File database berada di luar web root agar tidak bisa diunduh sebagai file statis.

## 3. Buat environment aplikasi

Buat file `/www/wwwroot/kwitansi/.env` melalui **Files**:

```dotenv
DATABASE_URL="file:/www/server/kwitansi-data/kwitansi.db"
AUTH_SECRET="GANTI_DENGAN_SECRET_ACAK"
PORT="3000"
APP_HOST="127.0.0.1"
```

Buat secret dari **Terminal** dengan `openssl rand -hex 48`, lalu masukkan hasilnya ke `AUTH_SECRET`. Batasi izin `.env` agar hanya user aplikasi/admin server yang dapat membacanya. Jangan commit atau membagikan file ini.

`DATABASE_URL` harus berupa path absolut dan tidak memakai URL-encoding. Direktori database harus writable oleh `www`. Jangan simpan database di folder project yang mungkin ditimpa saat upload versi baru.

## 4. Install dependency, siapkan schema, dan build

Buka **Terminal** aaPanel, lalu jalankan sebagai user `www`. Jika terminal sudah menggunakan user tersebut, lewati perintah `su`:

```bash
su -s /bin/bash www
cd /www/wwwroot/kwitansi
npm ci
npm run db:push
npm run build
```

Jika `su` tidak tersedia atau terminal sudah login sebagai `www`, jalankan tiga perintah `npm` langsung dari direktori project. Pastikan build dan migrasi selesai tanpa error sebelum project dinyalakan. `db:push` membuat atau menyesuaikan schema SQLite; jika sudah ada data, buat backup terlebih dahulu.

## 5. Tambahkan Node.js Project

Di aaPanel buka **Website → Node.js Project → Add Project → Default Project**. Gunakan konfigurasi berikut:

| Pengaturan | Nilai |
| --- | --- |
| Path | `/www/wwwroot/kwitansi` |
| Project Name | `kwitansi` |
| Run User | `www` |
| Node.js runtime | Node.js 22 atau lebih baru, sama dengan runtime saat build |
| Package manager | `npm` |
| Install dependencies | Matikan jika `npm ci` pada langkah sebelumnya sudah berhasil |
| Start command | `npm start` |
| Project Port | Sama dengan `PORT` di `.env`, contoh `3000` |

`npm start` membaca `PORT` dan `APP_HOST` dari `.env`; set `APP_HOST=127.0.0.1` supaya aplikasi hanya menerima koneksi dari VPS/reverse proxy. Jika mengganti `PORT`, samakan nilai pada `.env`, **Project Port**, dan target Mapping (`http://127.0.0.1:PORT`). Jangan gunakan mode `dev`. Aktifkan start otomatis setelah server reboot, lalu mulai project. aaPanel mendokumentasikan run user, runtime Node, package manager, start command, dan project port pada konfigurasi project Node.js-nya.

## 6. Hubungkan domain dan aktifkan HTTPS

1. Buka pengaturan project `kwitansi` di **Node.js Project → Domain Manager**, lalu tambahkan domain, misalnya `kwitansi.domainanda.id`.
2. Aktifkan **Mapping** untuk domain dan pilih Nginx. Pada aaPanel versi yang memakai menu terpisah, buat website/proxy yang meneruskan domain ke `http://127.0.0.1:3000`.
3. Pastikan konfigurasi proxy meneruskan `Host`, `X-Forwarded-For`, dan **`X-Forwarded-Proto`**. Header terakhir diperlukan agar cookie login memakai atribut `Secure` ketika domain dilayani melalui HTTPS.
4. Setelah domain berhasil dibuka melalui HTTP, buka tab **SSL** pada project/site mapping dan terbitkan sertifikat Let's Encrypt. Aktifkan redirect HTTP ke HTTPS setelah sertifikat aktif.

Dokumentasi aaPanel menjelaskan Mapping sebagai reverse proxy domain ke Node.js Project dan tab SSL tersedia setelah Mapping diaktifkan. Lihat [dokumentasi aaPanel](https://www.aapanel.com/docs/Function/Node.html#mapping).

## 7. Buat akun dan periksa aplikasi

Buka domain menggunakan HTTPS dan daftarkan akun pertama; akun itu menjadi pemilik workspace. Pemilik bisa menambahkan akun staf lewat menu **Manajemen pengguna**. Pendaftaran publik saat ini masih aktif, dan akun yang mendaftar selanjutnya mendapat workspace terpisah.

Coba login, buat satu transaksi, lalu restart project dari aaPanel dan pastikan data tetap tersimpan. Jika halaman menampilkan `502`, periksa **Node.js Project → Project log** dan pastikan service aktif pada port `3000`. Untuk error database, periksa izin tulis direktori `/www/server/kwitansi-data` bagi user `www` serta isi `.env`.

## 8. Backup dan pembaruan

Tambahkan jadwal di **Cron** aaPanel untuk membackup database secara konsisten. Contoh perintah (pastikan folder tujuan sudah dibuat dan dapat ditulis):

```bash
sqlite3 /www/server/kwitansi-data/kwitansi.db ".backup '/www/backup/kwitansi-$(date +%F-%H%M).db'"
```

Salin backup ke penyimpanan di luar VPS dan uji pemulihannya. Database mengandung data transaksi dan akun, jadi batasi akses backup.

Untuk memperbarui aplikasi, unggah source baru tanpa mengganti direktori database, lalu jalankan `npm ci`, `npm run db:push`, dan `npm run build` dengan user `www`. Setelah sukses, restart project dari aaPanel. Backup database sebelum perubahan schema dan pertahankan `AUTH_SECRET` yang sama.

## Catatan penting

- SQLite disiapkan untuk satu instance aplikasi yang mengakses satu file database di VPS. Jangan jalankan beberapa instance/cluster yang menulis ke file yang sama.
- Jangan buka port `3000` ke internet; domain publik harus melewati Nginx/Mapping aaPanel.
- `.env` berisi rahasia autentikasi dan harus tetap di server, tidak disertakan dalam arsip publik.
- Jika Node.js Project gagal menemukan `node` atau `npm`, samakan versi Node.js Manager untuk project dan command line aaPanel, lalu install ulang dependency.
