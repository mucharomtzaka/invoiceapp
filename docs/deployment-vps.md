# Deploy Kwitansi Pro ke VPS

Panduan ini untuk satu VPS Ubuntu/Debian dengan SQLite, Next.js, Nginx, HTTPS, dan systemd. SQLite cocok untuk satu server aplikasi dengan beban ringan sampai menengah. Jangan menjalankan beberapa instance aplikasi yang menulis ke file database yang sama di filesystem/network volume berbeda.

## 1. Siapkan server

Siapkan domain yang DNS `A`/`AAAA`-nya mengarah ke VPS. Pasang Node.js 22 atau lebih baru, npm, Nginx, Git, SQLite CLI, dan alat kompilasi native:

```bash
sudo apt update
sudo apt install -y nginx git sqlite3 build-essential python3
node --version
npm --version
```

Buat akun service dan lokasi database yang persisten:

```bash
sudo useradd --system --create-home --home-dir /opt/kwitansi --shell /usr/sbin/nologin kwitansi
sudo install -d -o kwitansi -g kwitansi /opt/kwitansi /var/lib/kwitansi
```

Unggah source project ke `/opt/kwitansi`, kemudian pastikan kepemilikannya benar. Jangan unggah `node_modules` dari Mac/Windows; binary `better-sqlite3` harus dipasang untuk Linux di VPS.

```bash
sudo chown -R kwitansi:kwitansi /opt/kwitansi
```

## 2. Konfigurasi environment

Buat `/opt/kwitansi/.env`:

```dotenv
DATABASE_URL="file:/var/lib/kwitansi/kwitansi.db"
AUTH_SECRET="GANTI_DENGAN_OUTPUT_OPENSSL"
PORT="3000"
APP_HOST="127.0.0.1"
```

Buat secret acak dengan `openssl rand -hex 48`, lalu gantikan nilai placeholder. Jangan commit `.env` ke Git atau bagikan nilainya. Atur hak akses:

```bash
sudo chown kwitansi:kwitansi /opt/kwitansi/.env
sudo chmod 600 /opt/kwitansi/.env
```

Path SQLite di atas harus memakai lokasi absolut tanpa URL-encoding. Direktori `/var/lib/kwitansi` harus dapat ditulis oleh user service.

## 3. Pasang dependency, schema, dan build

Jalankan perintah sebagai user `kwitansi` dari direktori project:

```bash
sudo -u kwitansi -H bash
cd /opt/kwitansi
npm ci
npm run db:push
npm run build
exit
```

`db:push` membuat atau memperbarui schema sesuai `prisma/schema.prisma`. Sebelum menjalankannya pada instalasi yang sudah memiliki data, buat backup database terlebih dahulu. Build production menggunakan Next.js; jangan jalankan `next dev` di VPS.

## 4. Jalankan sebagai service systemd

Buat `/etc/systemd/system/kwitansi.service`:

```ini
[Unit]
Description=Kwitansi Pro Next.js
After=network.target

[Service]
Type=simple
User=kwitansi
Group=kwitansi
WorkingDirectory=/opt/kwitansi
Environment=NODE_ENV=production
EnvironmentFile=/opt/kwitansi/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Jika `npm` tidak berada di `/usr/bin/npm`, cari lokasinya dengan `command -v npm` dan sesuaikan `ExecStart`. Aktifkan service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kwitansi
sudo systemctl status kwitansi
sudo journalctl -u kwitansi -n 100 --no-pager
```

Next.js hanya mendengarkan di `127.0.0.1`; jangan membuka port aplikasi langsung ke internet. Jika mengubah `PORT` di `.env`, gunakan port yang sama pada reverse proxy Nginx, lalu restart service.

## 5. Reverse proxy Nginx dan HTTPS

Buat konfigurasi site Nginx, misalnya `/etc/nginx/sites-available/kwitansi`:

```nginx
server {
    listen 80;
    server_name kwitansi.domainanda.id;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Aktifkan site dan periksa konfigurasinya:

```bash
sudo ln -s /etc/nginx/sites-available/kwitansi /etc/nginx/sites-enabled/kwitansi
sudo nginx -t
sudo systemctl reload nginx
```

Setelah DNS dan HTTP berfungsi, pasang sertifikat TLS dengan Certbot untuk Nginx. Header `X-Forwarded-Proto` perlu diteruskan agar cookie sesi diberi atribut `Secure` pada HTTPS. Batasi firewall publik ke SSH, HTTP, dan HTTPS.

## 6. Buat akun dan validasi

Buka domain HTTPS. Daftarkan akun pertama; akun tersebut menjadi pemilik workspace. Dari **Manajemen pengguna**, pemilik dapat menambahkan akun staf yang berbagi transaksi dan profil usahanya. Pendaftaran publik saat ini tetap terbuka: akun berikutnya yang mendaftar akan mendapat workspace terpisah. Setelah login, coba buat transaksi dan pastikan data tetap terlihat setelah service direstart.

## 7. Backup dan pembaruan

Jadwalkan backup SQLite dan salin hasilnya ke penyimpanan di luar VPS. Untuk membuat backup konsisten ketika aplikasi sedang berjalan:

```bash
sudo -u kwitansi sqlite3 /var/lib/kwitansi/kwitansi.db ".backup '/var/backups/kwitansi.db'"
```

Pastikan folder `/var/backups` tersedia dan backup diberi nama bertanggal oleh job terjadwal. Uji pemulihan backup secara berkala. Lindungi backup karena berisi transaksi dan data akun.

Untuk pembaruan, unggah source versi baru, lalu jalankan sebagai `kwitansi`:

```bash
cd /opt/kwitansi
npm ci
npm run db:push
npm run build
sudo systemctl restart kwitansi
```

Buat backup sebelum perubahan schema. Pertahankan `AUTH_SECRET` yang sama agar sesi yang masih valid tidak terputus. Jangan hapus atau menimpa `/var/lib/kwitansi/kwitansi.db` saat deploy.

## Pemecahan masalah

- **Service gagal start:** periksa `sudo journalctl -u kwitansi -n 100 --no-pager`.
- **Login/register atau database gagal:** periksa nilai `DATABASE_URL`, pastikan path absolut benar, serta user `kwitansi` dapat menulis ke direktori database.
- **Nginx 502:** pastikan service aktif dan mendengarkan pada `127.0.0.1:3000`.
- **Cookie sesi tidak tersimpan:** pastikan situs dibuka melalui HTTPS dan Nginx mengirim `X-Forwarded-Proto`.
- **Build native SQLite gagal:** pastikan dependency dipasang di VPS Linux, bukan menyalin `node_modules` dari sistem operasi lain; sediakan `build-essential` dan Python jika npm perlu membangun modul dari source.
