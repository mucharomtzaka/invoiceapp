# DESIGN.md
# Aplikasi Kwitansi, Bukti Pembayaran & Transaksi

**Versi:** 2.0  
**Platform:** Web Application  
**Bahasa:** Indonesia  
**Mata Uang:** Rupiah (IDR)

---

# 1. DESKRIPSI APLIKASI

Aplikasi web untuk membuat, mengelola, menyimpan, mencetak, dan mengekspor kwitansi atau bukti pembayaran transaksi.

Aplikasi dirancang fleksibel untuk berbagai jenis kebutuhan transaksi, seperti:

- Penjualan barang.
- Penjualan jasa.
- Pembayaran umum.
- Transaksi toko.
- Transaksi kasir.
- Pembelian bahan bakar (BBM).
- Administrasi bisnis.
- Bukti pembayaran pelanggan.

Pengguna dapat memasukkan rincian transaksi, menambahkan banyak item, mengatur diskon, PPN, dan menghasilkan dokumen dalam berbagai format.

Aplikasi mendukung beberapa jenis output:

1. Kwitansi panjang A4/A5.
2. Kwitansi landscape.
3. Struk pendek thermal 58mm.
4. Struk pendek thermal 80mm.
5. PDF.
6. Excel (.xlsx).

**Prinsip utama:** Satu transaksi dapat dicetak dalam berbagai format tanpa perlu memasukkan data ulang.

---

# 2. TUJUAN APLIKASI

- Mempermudah pembuatan kwitansi dan bukti pembayaran.
- Membuat transaksi secara cepat.
- Menghitung subtotal, diskon, PPN, dan total otomatis.
- Mendukung transaksi dengan banyak item.
- Mendukung format cetak panjang dan pendek.
- Mendukung printer biasa dan printer thermal.
- Menyediakan export Excel untuk laporan.
- Menyimpan riwayat transaksi.
- Menyediakan template untuk transaksi umum dan BBM.
- Menghasilkan dokumen profesional dan mudah dibaca.

---

# 3. DESIGN SYSTEM DAN UI/UX

## 3.1 Design Direction

Gunakan desain modern minimalis dengan gaya aplikasi administrasi bisnis.

Karakteristik:
- Clean dan profesional.
- Navigasi sederhana.
- Mudah digunakan pengguna awam.
- Tidak terlalu banyak dekorasi.
- Fokus pada form transaksi.
- Responsive desktop, tablet, dan mobile.
- Form input dan preview mudah diakses.

## 3.2 Color Palette

| Elemen | Warna |
|---|---|
| Primary | #4F46E5 |
| Primary Hover | #4338CA |
| Background | #F8FAFC |
| Surface | #FFFFFF |
| Text Primary | #0F172A |
| Text Secondary | #64748B |
| Border | #E2E8F0 |
| Success | #16A34A |
| Danger | #DC2626 |

## 3.3 Typography

Gunakan:
- Inter.
- Plus Jakarta Sans.

Untuk struk thermal gunakan:
- Monospace.
- Courier New.
- Font khusus thermal jika tersedia.

## 3.4 Layout Aplikasi

Gunakan sidebar pada desktop dan navigasi yang lebih ringkas pada mobile.

---

# 4. STRUKTUR MENU APLIKASI

Menu utama:

1. Dashboard
2. Buat Transaksi
3. Riwayat Transaksi
4. Laporan & Export
5. Pengaturan
6. Profil Usaha

---

# 5. DASHBOARD

Dashboard menampilkan ringkasan aktivitas transaksi.

Informasi:

- Total transaksi.
- Total pembayaran.
- Total transaksi lunas.
- Total transaksi belum lunas.
- Total transaksi bulan ini.
- Transaksi terbaru.

Tampilkan tabel transaksi terbaru:

| Nomor | Tanggal | Pelanggan | Total | Status | Aksi |
|---|---|---|---:|---|---|

Aksi:
- Lihat.
- Edit.
- Cetak.
- Download PDF.
- Export Excel.
- Hapus.

---

# 6. PEMBUATAN TRANSAKSI

Halaman utama aplikasi adalah halaman pembuatan transaksi.

Layout desktop menggunakan dua area:

**Area kiri:** Form input transaksi.

**Area kanan:** Live Preview dokumen.

Pada mobile, form dan preview ditampilkan secara vertikal.

## 6.1 Jenis Transaksi

Sediakan pilihan jenis dokumen:

- Kwitansi umum.
- Bukti pembayaran.
- Struk penjualan.
- Transaksi BBM.

Setiap jenis transaksi dapat menggunakan template cetak yang berbeda.

## 6.2 Informasi Transaksi

Field:

- Nomor transaksi.
- Tanggal transaksi.
- Waktu transaksi.
- Nama usaha.
- Alamat usaha.
- Nomor telepon.
- Nama pelanggan.
- Alamat pelanggan (opsional).
- Keterangan transaksi.

Nomor transaksi dibuat otomatis dan dapat diedit.

Contoh:
- INV-20261117-001
- KW-20261117-001
- BBM-20261117-001

## 6.3 Pengaturan Dokumen

Pengaturan:

**Orientasi:**
- Portrait.
- Landscape.

**Ukuran kertas:**
- A4.
- A5.
- Thermal 58mm.
- Thermal 80mm.

Perubahan harus langsung terlihat pada Live Preview.

---

# 7. DETAIL BARANG ATAU JASA

Pengguna dapat menambahkan banyak item transaksi.

Tabel input:

| No | Nama Barang / Keterangan | Qty | Harga Satuan | Subtotal | Aksi |
|---|---|---:|---:|---:|---|
| 1 | Produk A | 2 | 100.000 | 200.000 | Hapus |
| 2 | Jasa B | 1 | 150.000 | 150.000 | Hapus |

Fitur:
- Tambah item.
- Hapus item.
- Edit nama barang.
- Edit quantity.
- Edit harga satuan.
- Subtotal otomatis.
- Tambah baris tanpa batas praktis.

Rumus:

Subtotal Item = Quantity × Harga Satuan

Subtotal Transaksi = Jumlah seluruh subtotal item.

---

# 8. PENGATURAN DISKON

Diskon bersifat opsional.

Jenis diskon:
- Persentase (%).
- Nominal Rupiah (Rp).

Field:
- Jenis diskon.
- Nilai diskon.

Rumus:

Diskon Persen = Subtotal × Persentase / 100

Diskon Rupiah = Nominal yang dimasukkan pengguna.

Diskon tidak boleh melebihi subtotal transaksi.

---

# 9. PENGATURAN PPN

PPN bersifat opsional.

Pilihan:
- Tanpa PPN.
- PPN Persentase (%).
- PPN Nominal (Rp).

Field:
- Jenis PPN.
- Nilai PPN.

Rumus:

Jika persen:

PPN = DPP × Persentase / 100

Jika nominal:

PPN = Nominal PPN yang diinput pengguna.

DPP = Subtotal - Diskon.

Tarif PPN tidak boleh dipaksakan oleh aplikasi. Pengguna bebas memasukkan nominal atau persentase sesuai kebutuhan transaksi.

---

# 10. RINGKASAN PEMBAYARAN

Tampilkan ringkasan transaksi secara jelas.

Contoh:

| Keterangan | Nominal |
|---|---:|
| Subtotal | Rp350.000 |
| Diskon 10% | -Rp35.000 |
| DPP | Rp315.000 |
| PPN 11% | Rp34.650 |
| **TOTAL PEMBAYARAN** | **Rp349.650** |

Rumus:

```text
Subtotal = SUM(Qty × Harga Satuan)

Diskon =
  Jika persen: Subtotal × Diskon% / 100
  Jika nominal: Nominal Diskon

DPP = Subtotal - Diskon

PPN =
  Jika persen: DPP × PPN% / 100
  Jika nominal: Nominal PPN

Total Pembayaran = DPP + PPN
```

Semua perhitungan diperbarui secara real-time.

Gunakan pembulatan Rupiah tanpa desimal.

---

# 11. INFORMASI PEMBAYARAN

Field tambahan:

- Metode pembayaran.
- Status pembayaran.
- Catatan.
- Nama penerima.
- Nama kasir/operator.

Metode pembayaran:
- Tunai.
- Transfer bank.
- QRIS.
- Debit.
- Kredit.
- E-wallet.
- Lainnya.

Status:
- Lunas.
- Belum lunas.
- DP / Uang muka.
- Sebagian dibayar.

Informasi pembayaran tambahan bersifat opsional.

---

# 12. TEMPLATE TRANSAKSI BBM

Sediakan template khusus transaksi pembelian bahan bakar.

Field tambahan:

- Jenis BBM.
- Volume (Liter).
- Harga per liter.
- Nomor kendaraan.
- Nomor dispenser/pompa.
- Nomor transaksi.
- Nama operator.
- Tanggal dan waktu transaksi.

Contoh jenis BBM:
- Pertalite.
- Pertamax.
- Solar.
- Dexlite.
- Pertamina Dex.
- Jenis lainnya.

Informasi BBM dapat digunakan sebagai item transaksi biasa maupun field khusus.

Rumus:

Total BBM = Volume × Harga per Liter.

Jika ada diskon atau PPN, gunakan mekanisme perhitungan transaksi umum.

Semua field BBM bersifat opsional kecuali informasi yang dibutuhkan untuk transaksi tersebut.

---

# 13. LIVE PREVIEW

Live Preview adalah fitur utama aplikasi.

Setiap perubahan pada form harus langsung terlihat pada preview.

Perubahan meliputi:
- Nama usaha.
- Nomor transaksi.
- Tanggal.
- Nama pelanggan.
- Item barang.
- Quantity.
- Harga.
- Diskon.
- PPN.
- Total pembayaran.
- Orientasi.
- Ukuran kertas.
- Template cetak.

Sediakan tombol:
- Preview.
- Fullscreen Preview.
- Cetak.
- Download PDF.

Preview harus menggunakan layout yang sama dengan hasil PDF dan cetak.

---

# 14. FORMAT CETAK PANJANG

Format panjang digunakan untuk kwitansi dan bukti pembayaran formal.

Ukuran:
- A4 Portrait.
- A4 Landscape.
- A5 Portrait.
- A5 Landscape.

Struktur dokumen:

1. Logo dan nama usaha.
2. Alamat dan kontak usaha.
3. Judul KWITANSI / BUKTI PEMBAYARAN.
4. Nomor transaksi.
5. Tanggal.
6. Informasi pelanggan.
7. Tabel item transaksi.
8. Subtotal.
9. Diskon.
10. DPP.
11. PPN.
12. Total pembayaran.
13. Terbilang.
14. Metode pembayaran.
15. Catatan.
16. Tanda tangan.

Desain harus profesional, bersih, dan cocok untuk kebutuhan administrasi perusahaan maupun perorangan.

---

# 15. FORMAT CETAK PENDEK (THERMAL RECEIPT)

Fitur cetak pendek merupakan salah satu fitur utama aplikasi.

Desain terinspirasi dari struk transaksi minimarket dan SPBU.

Contoh referensi:
- Struk belanja minimarket.
- Struk pembayaran kasir.
- Struk pembelian BBM.

## 15.1 Ukuran Thermal

Dukungan:
- Thermal 58mm.
- Thermal 80mm.

## 15.2 Karakteristik Desain

- Background putih.
- Teks hitam.
- Layout vertikal.
- Font monospace.
- Garis pemisah putus-putus.
- Nominal rata kanan.
- Header rata tengah.
- Tidak menggunakan warna dekoratif.
- Margin kecil.
- Hemat kertas.
- Nama item dapat membungkus otomatis.
- Tidak ada elemen UI aplikasi saat dicetak.

## 15.3 Contoh Struk Umum

```text
================================
          NAMA USAHA
       Alamat / Lokasi Usaha
          Telp. 08xxxx
================================
         BUKTI PEMBAYARAN
--------------------------------
No      : KW-20261117-001
Tanggal : 17-11-2026
Waktu   : 09:30:15
Kasir   : Admin
Pelanggan: Umum
--------------------------------
Produk A
  2 x 100.000          200.000

Produk B
  1 x 150.000          150.000
--------------------------------
Subtotal               350.000
Diskon                 -35.000
DPP                    315.000
PPN 11%                 34.650
--------------------------------
TOTAL                  349.650
================================
Metode : Tunai
Status : LUNAS
--------------------------------

         TERIMA KASIH
    Selamat berbelanja kembali

================================
```

## 15.4 Contoh Struk BBM

```text
================================
          NAMA USAHA
        BUKTI PEMBAYARAN
================================
No Transaksi : BBM-00125
Tanggal      : 17/11/2026
Waktu        : 09:30:15
Operator     : Admin
--------------------------------
Jenis BBM    : Pertamax
Volume       : 20.00 Liter
Harga/Liter  : Rp12.000
--------------------------------
Subtotal     : Rp240.000
Diskon       : Rp0
PPN          : Rp0
--------------------------------
TOTAL        : Rp240.000
--------------------------------
Kendaraan    : B 1234 XYZ
Pembayaran   : QRIS
Status       : LUNAS
================================
          TERIMA KASIH
================================
```

Contoh di atas hanya ilustrasi desain dan tidak menggunakan identitas resmi perusahaan lain.

## 15.5 Pengaturan Struk

Pengguna dapat mengatur:

- Lebar kertas.
- Ukuran font.
- Jarak antarbaris.
- Margin kiri dan kanan.
- Tampilkan logo.
- Tampilkan alamat.
- Tampilkan nomor telepon.
- Tampilkan pelanggan.
- Tampilkan catatan.
- Tampilkan terbilang.
- Tampilkan tanda tangan.

## 15.6 Print Settings

Sebelum mencetak, pengguna dapat memilih:

- Thermal 58mm.
- Thermal 80mm.
- Jumlah salinan.
- Ukuran font.
- Margin.
- Opsi informasi yang ditampilkan.

Gunakan CSS Print khusus.

Pastikan:
- Lebar dokumen sesuai kertas.
- Tidak ada halaman kosong.
- Tidak ada bagian terpotong.
- Tidak ada horizontal scrollbar pada hasil cetak.
- Tidak ada elemen dashboard yang ikut tercetak.
- Tinggi struk mengikuti panjang konten.

Printer thermal dapat digunakan melalui dialog cetak browser. Integrasi langsung dengan printer melalui USB, Bluetooth, atau jaringan dapat dikembangkan sebagai fitur tambahan.

---

# 16. EXPORT PDF

Aplikasi menyediakan fitur download PDF.

Pilihan format:
- A4 Portrait.
- A4 Landscape.
- A5 Portrait.
- A5 Landscape.
- Thermal 58mm.
- Thermal 80mm.

Ketentuan:
- PDF mengikuti template preview.
- Tidak ada elemen aplikasi.
- Font tetap terbaca.
- Format Rupiah konsisten.
- Ukuran dokumen sesuai pilihan.
- Tidak terpotong.
- Hasil PDF siap dicetak.

---

# 17. EXPORT EXCEL

Aplikasi harus mendukung export Excel dengan ekstensi .xlsx.

## 17.1 Export Satu Transaksi

Pengguna dapat mengunduh satu transaksi dalam bentuk Excel.

Sheet: Detail Transaksi.

Informasi:
- Nomor transaksi.
- Tanggal.
- Nama usaha.
- Pelanggan.
- Keterangan.

Tabel item:

| No | Nama Item | Qty | Harga Satuan | Subtotal |
|---|---|---:|---:|---:|
| 1 | Produk A | 2 | 100000 | 200000 |
| 2 | Produk B | 1 | 150000 | 150000 |

Ringkasan:
- Subtotal.
- Diskon.
- DPP.
- PPN.
- Total.
- Metode pembayaran.
- Status pembayaran.

## 17.2 Export Banyak Transaksi

Pada halaman riwayat, sediakan tombol Export Excel.

Pilihan:
- Export semua transaksi.
- Export berdasarkan tanggal.
- Export berdasarkan pelanggan.
- Export berdasarkan status.
- Export transaksi terpilih.

Kolom laporan:

| No | Nomor Transaksi | Tanggal | Pelanggan | Subtotal | Diskon | PPN | Total | Status |
|---|---|---|---|---:|---:|---:|---:|---|

## 17.3 Format Excel

- Format .xlsx.
- Header bold.
- Nominal menggunakan tipe angka.
- Format angka Rupiah.
- Lebar kolom otomatis.
- Freeze header.
- Filter tabel.
- Baris total.
- Nama file menggunakan tanggal export.

Contoh:
`Laporan_Transaksi_2026-11-17.xlsx`

---

# 18. RIWAYAT TRANSAKSI

Halaman untuk melihat seluruh transaksi yang tersimpan.

Fitur:
- Pencarian nomor transaksi.
- Pencarian nama pelanggan.
- Filter tanggal.
- Filter status.
- Filter jenis transaksi.
- Sorting transaksi.
- Lihat detail.
- Edit.
- Hapus.
- Cetak ulang.
- Download PDF.
- Export Excel.

Satu transaksi dapat dicetak menggunakan berbagai template tanpa mengubah data aslinya.

---

# 19. LAPORAN & EXPORT

Halaman laporan menyediakan ringkasan transaksi.

Informasi:
- Total transaksi.
- Total penjualan.
- Total pembayaran.
- Total diskon.
- Total PPN.
- Total transaksi lunas.
- Total transaksi belum lunas.

Filter laporan:
- Harian.
- Mingguan.
- Bulanan.
- Tahunan.
- Rentang tanggal.

Sediakan:
- Export Excel.
- Download PDF laporan.
- Print laporan.

---

# 20. PROFIL USAHA

Pengguna dapat mengatur identitas usaha.

Field:
- Nama usaha.
- Logo.
- Alamat.
- Nomor telepon.
- Email.
- Website.
- NPWP (opsional).
- Informasi rekening bank (opsional).

Profil otomatis digunakan saat membuat transaksi baru.

---

# 21. PENGATURAN TEMPLATE

Sediakan halaman untuk mengatur template dokumen.

Pengaturan:
- Template kwitansi panjang.
- Template struk thermal.
- Template BBM.
- Logo.
- Ukuran font.
- Ukuran kertas.
- Margin.
- Informasi header.
- Informasi footer.
- Format nomor transaksi.

Pengguna dapat memilih template default untuk setiap jenis transaksi.

---

# 22. BUSINESS LOGIC DAN VALIDASI

Ketentuan:

1. Quantity tidak boleh negatif.
2. Harga satuan tidak boleh negatif.
3. Diskon tidak boleh melebihi subtotal.
4. PPN tidak boleh negatif.
5. Persentase harus divalidasi.
6. Minimal satu item transaksi.
7. Semua perhitungan otomatis.
8. Pembulatan Rupiah tanpa desimal.
9. Total tidak boleh negatif.
10. Nomor transaksi harus unik.
11. Data yang sudah tersimpan harus tetap konsisten pada seluruh format dokumen.

Perhitungan dilakukan menggunakan nilai numerik, bukan string hasil format Rupiah.

---

# 23. STRUKTUR DATABASE

## BusinessProfile

- id
- businessName
- logo
- address
- phone
- email
- website
- npwp
- createdAt
- updatedAt

## Receipt

- id
- receiptNumber
- transactionType
- transactionDate
- transactionTime
- customerName
- customerAddress
- description
- orientation
- paperSize
- subtotal
- discountType
- discountValue
- discountAmount
- dpp
- taxType
- taxValue
- taxAmount
- total
- paymentMethod
- paymentStatus
- notes
- createdAt
- updatedAt

## ReceiptItem

- id
- receiptId
- name
- quantity
- unitPrice
- subtotal

## FuelTransaction

- id
- receiptId
- fuelType
- volume
- pricePerLiter
- vehicleNumber
- dispenserNumber
- operatorName

## PrintTemplate

- id
- templateName
- templateType
- paperSize
- orientation
- fontSize
- margin
- showLogo
- showCustomer
- showNotes
- isDefault

---

# 24. TEKNOLOGI YANG DIREKOMENDASIKAN

Frontend:
- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Lucide Icons.

Form:
- React Hook Form.
- Zod.

Database:
- PostgreSQL atau SQLite.
- Prisma ORM.

PDF:
- HTML to PDF atau library PDF yang mendukung custom page size.
- CSS Print untuk hasil cetak.

Excel:
- ExcelJS atau SheetJS.

Pastikan seluruh library mendukung kebutuhan ukuran kertas dan format output.

---

# 25. RESPONSIVE DESIGN

Desktop:
- Sidebar.
- Form dan preview berdampingan.
- Tabel transaksi lengkap.

Tablet:
- Navigasi ringkas.
- Form dan preview menyesuaikan lebar layar.

Mobile:
- Navigasi sederhana.
- Form satu kolom.
- Tabel item dapat di-scroll secara horizontal atau menggunakan kartu.
- Preview dapat dibuka fullscreen.
- Tombol aksi mudah dijangkau.

Hasil dokumen cetak harus tetap menggunakan ukuran kertas sebenarnya, bukan mengikuti ukuran layar mobile.

---

# 26. KEAMANAN DAN PENYIMPANAN

- Validasi seluruh input.
- Gunakan penyimpanan database untuk transaksi.
- Jangan menyimpan nominal sebagai string.
- Pastikan nomor transaksi unik.
- Sediakan backup data.
- Sediakan export data.
- Konfirmasi sebelum menghapus transaksi.
- Hindari perubahan data transaksi saat proses export atau print.

---

# 27. PRIORITAS PENGEMBANGAN

## Phase 1 - Core Application

- Dashboard.
- Buat transaksi.
- Tambah dan hapus item.
- Perhitungan subtotal.
- Diskon persen dan Rupiah.
- PPN persen dan Rupiah.
- Live Preview.
- Template portrait dan landscape.
- Template thermal 58mm dan 80mm.
- Print.
- Download PDF.
- Export Excel satu transaksi.

## Phase 2 - Transaction Management

- Simpan transaksi.
- Riwayat transaksi.
- Edit transaksi.
- Cetak ulang.
- Profil usaha.
- Pengaturan template.
- Export Excel banyak transaksi.

## Phase 3 - Advanced Features

- Template BBM.
- Terbilang otomatis.
- Upload logo.
- Tanda tangan digital.
- Laporan transaksi.
- Backup data.
- Integrasi printer thermal langsung.
- Multi-template.

---

# 28. ACCEPTANCE CRITERIA

Aplikasi dinyatakan selesai jika:

### Transaksi
- Dapat membuat transaksi umum.
- Dapat menambahkan banyak item.
- Dapat menghitung subtotal otomatis.
- Dapat memasukkan diskon Rupiah dan persen.
- Dapat memasukkan PPN Rupiah dan persen.
- Total pembayaran dihitung secara akurat.

### Dokumen
- Mendukung portrait dan landscape.
- Mendukung A4 dan A5.
- Mendukung thermal 58mm dan 80mm.
- Mendukung template transaksi BBM.
- Live Preview bekerja secara real-time.

### Cetak
- Hasil cetak panjang rapi.
- Hasil cetak pendek menyerupai struk kasir.
- Hasil cetak tidak terpotong.
- Ukuran kertas sesuai pengaturan.
- Bisa dicetak berulang kali.

### Export
- Dapat mengunduh PDF.
- Dapat export satu transaksi ke Excel.
- Dapat export banyak transaksi ke Excel.
- Data Excel dapat diolah kembali.

### Management
- Transaksi dapat disimpan.
- Riwayat dapat dicari.
- Transaksi dapat diedit.
- Transaksi dapat dicetak ulang.
- Data tetap konsisten di semua format.

---

# 29. PRINSIP UTAMA PENGEMBANGAN

Aplikasi harus sederhana, cepat, dan mudah digunakan.

Prioritaskan pengalaman pengguna ketika membuat transaksi.

Jangan membuat pengguna harus mengisi terlalu banyak informasi untuk transaksi sederhana.

Gunakan field opsional untuk informasi tambahan.

Satu sumber data transaksi harus digunakan oleh semua output:
- Preview.
- Cetak panjang.
- Cetak pendek.
- PDF.
- Excel.

Jangan membuat perhitungan terpisah untuk masing-masing template.

Pastikan semua output memiliki nominal yang sama dan konsisten.

**Hasil akhir yang diharapkan:**

Sebuah aplikasi administrasi transaksi yang dapat digunakan untuk membuat kwitansi profesional, bukti pembayaran, struk kasir, dan struk BBM, lengkap dengan fitur cetak dan export laporan Excel.