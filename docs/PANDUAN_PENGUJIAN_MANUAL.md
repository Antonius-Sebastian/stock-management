# Panduan Pengujian Manual - Sistem Manajemen Stok

**Versi:** 1.0  
**Tanggal:** 2025-01-25  
**Status:** Final

## Daftar Isi

1. [Pendahuluan](#pendahuluan)
2. [Persiapan Pengujian](#persiapan-pengujian)
3. [Pengujian Berdasarkan Role](#pengujian-berdasarkan-role)
4. [Pengujian Fitur Utama](#pengujian-fitur-utama)
5. [Pengujian Edge Cases](#pengujian-edge-cases)
6. [Pengujian Logika Bisnis](#pengujian-logika-bisnis)
7. [Checklist Pengujian](#checklist-pengujian)

---

## Pendahuluan

Dokumen ini berisi panduan lengkap untuk pengujian manual sistem manajemen stok. Panduan ini mencakup:

- Pengujian berdasarkan role pengguna (ADMIN, OFFICE_PURCHASING, OFFICE_WAREHOUSE)
- Pengujian semua fitur utama aplikasi
- Pengujian edge cases dan skenario batas
- Validasi logika bisnis dan aturan stok
- Verifikasi penanganan error

### Prasyarat

Sebelum memulai pengujian, pastikan:

1. **Database sudah di-setup** dengan data seed (jika ada)
2. **Aplikasi berjalan** di environment development/staging
3. **Akun penguji tersedia** untuk setiap role:
   - ADMIN
   - OFFICE_PURCHASING
   - OFFICE_WAREHOUSE
4. **Data master tersedia**:
   - Minimal 2-3 Bahan Baku (Raw Materials)
   - Minimal 2-3 Produk Jadi (Finished Goods)
   - Minimal 2 Lokasi (Locations)
   - Minimal 2-3 Drum untuk setiap bahan baku

---

## Persiapan Pengujian

### 1. Setup Data Awal

#### Bahan Baku (Raw Materials)

- Buat minimal 3 bahan baku dengan kode unik
- Pastikan setiap bahan baku memiliki minimal 2 drum
- Catat ID drum untuk pengujian

#### Produk Jadi (Finished Goods)

- Buat minimal 3 produk jadi dengan nama unik
- Pastikan produk jadi tidak memiliki stok awal

#### Lokasi (Locations)

- Buat minimal 2 lokasi (contoh: "Gudang Utama", "Gudang Cabang")
- Set salah satu sebagai default location

#### User Accounts

- Buat 1 akun ADMIN
- Buat 1 akun OFFICE_PURCHASING
- Buat 1 akun OFFICE_WAREHOUSE

### 2. Tools Pengujian

- Browser modern (Chrome, Firefox, Edge)
- Developer Tools (F12) untuk melihat console errors
- Notepad untuk mencatat hasil pengujian
- Kalkulator untuk verifikasi perhitungan stok

---

## Pengujian Berdasarkan Role

### Role: ADMIN

**Hak Akses:** Full access ke semua fitur

#### 1.1 Login sebagai ADMIN

- [ ] Login dengan kredensial ADMIN
- [ ] Verifikasi redirect ke halaman utama
- [ ] Verifikasi menu navigasi menampilkan semua fitur

#### 1.2 Manajemen Bahan Baku

- [ ] **Buat Bahan Baku Baru**
  - Masuk ke halaman Raw Materials
  - Klik tombol "Tambah Bahan Baku"
  - Isi form: Kode, Nama, MOQ (Minimum Order Quantity)
  - Submit dan verifikasi data tersimpan
  - Verifikasi bahan baku muncul di tabel

- [ ] **Edit Bahan Baku**
  - Pilih bahan baku dari tabel
  - Klik tombol edit
  - Ubah nama atau MOQ
  - Submit dan verifikasi perubahan tersimpan

- [ ] **Hapus Bahan Baku**
  - Pilih bahan baku yang tidak memiliki stok
  - Klik tombol hapus
  - Konfirmasi penghapusan
  - Verifikasi bahan baku terhapus dari tabel

#### 1.3 Manajemen Produk Jadi

- [ ] **Buat Produk Jadi Baru**
  - Masuk ke halaman Finished Goods
  - Klik tombol "Tambah Produk Jadi"
  - Isi form: Nama, Deskripsi (opsional)
  - Submit dan verifikasi data tersimpan

- [ ] **Edit Produk Jadi**
  - Pilih produk jadi dari tabel
  - Klik tombol edit
  - Ubah nama atau deskripsi
  - Submit dan verifikasi perubahan tersimpan

- [ ] **Hapus Produk Jadi**
  - Pilih produk jadi yang tidak memiliki stok
  - Klik tombol hapus
  - Konfirmasi penghapusan
  - Verifikasi produk jadi terhapus

#### 1.4 Manajemen Stok - Bahan Baku

**Stok Masuk (IN) - Bahan Baku**

- [ ] **Stok Masuk dengan Drum**
  - Masuk ke halaman detail bahan baku
  - Klik "Tambah Stok Masuk"
  - Pilih drum yang sudah ada atau buat drum baru
  - Isi: Tanggal (tidak boleh masa depan), Jumlah, Deskripsi
  - Submit dan verifikasi:
    - Stok drum bertambah
    - Stok aggregate bahan baku bertambah
    - Movement history tercatat
    - Running balance benar

- [ ] **Stok Masuk Multiple Drum (Drum Stock In)**
  - Masuk ke halaman detail bahan baku
  - Klik "Tambah Stok Masuk Drum"
  - Tambah minimal 2 drum dengan label berbeda
  - Isi jumlah untuk setiap drum
  - Submit dan verifikasi:
    - Semua drum terbuat dengan jumlah yang benar
    - Stok aggregate = jumlah semua drum
    - Movement history tercatat untuk setiap drum

**Stok Keluar (OUT) - Bahan Baku**

- [ ] **Stok Keluar dari Drum**
  - Pastikan drum memiliki stok cukup
  - Klik "Tambah Stok Keluar"
  - Pilih drum yang memiliki stok
  - Isi: Tanggal, Jumlah (tidak melebihi stok drum)
  - Submit dan verifikasi:
    - Stok drum berkurang
    - Stok aggregate berkurang
    - Movement history tercatat
    - Jika stok drum = 0, drum menjadi inactive

- [ ] **Stok Keluar Melebihi Stok Tersedia**
  - Coba keluarkan stok lebih besar dari stok tersedia
  - Verifikasi error message muncul: "Insufficient stock"
  - Verifikasi stok tidak berubah

**Penyesuaian Stok (ADJUSTMENT) - Bahan Baku**

- [ ] **Adjustment dengan newStock (Metode Utama)**
  - Masuk ke halaman detail bahan baku
  - Catat stok saat ini
  - Klik "Penyesuaian Stok"
  - Pilih drum
  - Isi newStock (target stok baru)
  - Submit dan verifikasi:
    - Stok drum berubah menjadi newStock
    - Movement quantity = newStock - stok lama
    - Movement history tercatat sebagai ADJUSTMENT

- [ ] **Adjustment dengan quantity (Metode Alternatif)**
  - Klik "Penyesuaian Stok"
  - Pilih drum
  - Isi quantity (bisa positif atau negatif)
  - Submit dan verifikasi stok berubah sesuai quantity

- [ ] **Adjustment Negatif yang Menyebabkan Stok Negatif**
  - Coba adjustment negatif yang membuat stok < 0
  - Verifikasi error message muncul
  - Verifikasi stok tidak berubah

#### 1.5 Manajemen Stok - Produk Jadi

**Stok Masuk (IN) - Produk Jadi**

- [ ] **Stok Masuk ke Lokasi**
  - Masuk ke halaman detail produk jadi
  - Klik "Tambah Stok Masuk"
  - Pilih lokasi (wajib)
  - Isi: Tanggal, Jumlah, Deskripsi
  - Submit dan verifikasi:
    - Stok di lokasi bertambah
    - Movement history tercatat
    - Running balance benar
    - Stok di lokasi lain tidak berubah

**Stok Keluar (OUT) - Produk Jadi**

- [ ] **Stok Keluar dari Lokasi**
  - Pastikan lokasi memiliki stok cukup
  - Klik "Tambah Stok Keluar"
  - Pilih lokasi yang memiliki stok
  - Isi: Tanggal, Jumlah (tidak melebihi stok lokasi)
  - Submit dan verifikasi:
    - Stok di lokasi berkurang
    - Movement history tercatat
    - Stok di lokasi lain tidak berubah

- [ ] **Stok Keluar Melebihi Stok Tersedia**
  - Coba keluarkan stok lebih besar dari stok di lokasi
  - Verifikasi error message muncul
  - Verifikasi stok tidak berubah

**Penyesuaian Stok (ADJUSTMENT) - Produk Jadi**

- [ ] **Adjustment dengan newStock**
  - Pilih lokasi
  - Catat stok saat ini di lokasi
  - Klik "Penyesuaian Stok"
  - Isi newStock (target stok baru)
  - Submit dan verifikasi:
    - Stok di lokasi berubah menjadi newStock
    - Movement history tercatat

#### 1.6 Manajemen Batch

- [ ] **Buat Batch Baru**
  - Masuk ke halaman Batches
  - Klik "Tambah Batch"
  - Isi: Kode Batch (unik), Tanggal, Deskripsi
  - Tambah minimal 2 bahan baku dengan drum
  - Submit dan verifikasi:
    - Batch terbuat
    - Stok bahan baku berkurang sesuai penggunaan
    - Stok drum berkurang
    - Movement OUT tercatat untuk setiap drum
    - Batch usage tercatat

- [ ] **Edit Batch**
  - Pilih batch yang sudah ada
  - Klik tombol edit
  - Ubah kode, tanggal, atau bahan baku
  - Submit dan verifikasi:
    - Stok lama dikembalikan
    - Stok baru dikurangi
    - Batch usage terupdate
    - Movement history terupdate

- [ ] **Hapus Batch**
  - Pilih batch yang sudah ada
  - Klik tombol hapus
  - Konfirmasi penghapusan
  - Verifikasi:
    - Stok semua bahan baku dikembalikan
    - Stok drum dikembalikan
    - Batch terhapus
    - Movement history terhapus

#### 1.7 Edit dan Hapus Movement

- [ ] **Edit Movement - Bahan Baku**
  - Masuk ke movement history bahan baku
  - Pilih movement yang ingin diedit
  - Klik tombol edit
  - Ubah jumlah atau tanggal
  - Submit dan verifikasi:
    - Stok terupdate sesuai perubahan
    - Movement history terupdate
    - Running balance terhitung ulang dengan benar

- [ ] **Edit Movement - Produk Jadi**
  - Masuk ke movement history produk jadi
  - Pilih movement yang ingin diedit
  - Ubah jumlah, tanggal, atau lokasi
  - Submit dan verifikasi:
    - Stok lokasi lama dikembalikan
    - Stok lokasi baru diupdate
    - Movement history terupdate

- [ ] **Edit Movement Batch-Linked**
  - Pilih movement yang terkait dengan batch
  - Edit jumlah
  - Verifikasi batch usage terupdate

- [ ] **Hapus Movement**
  - Pilih movement yang ingin dihapus
  - Klik tombol hapus
  - Konfirmasi penghapusan
  - Verifikasi:
    - Stok dikembalikan (reversed)
    - Movement terhapus dari history
    - Running balance terhitung ulang

- [ ] **Hapus Movement Batch-Linked**
  - Hapus movement yang terkait batch
  - Verifikasi batch usage terhapus
  - Verifikasi stok dikembalikan

#### 1.8 Laporan (Reports)

- [ ] **Lihat Laporan Stok**
  - Masuk ke halaman Reports
  - Pilih tahun dan bulan
  - Pilih lokasi (untuk produk jadi)
  - Klik "Tampilkan Laporan"
  - Verifikasi:
    - Data stok awal bulan benar
    - Data stok akhir bulan benar
    - Total IN dan OUT benar
    - Perhitungan sesuai dengan movement history

- [ ] **Export Laporan**
  - Generate laporan
  - Klik tombol "Export"
  - Verifikasi file Excel/CSV terunduh
  - Buka file dan verifikasi data lengkap dan benar

#### 1.9 Manajemen User

- [ ] **Buat User Baru**
  - Masuk ke halaman Users
  - Klik "Tambah User"
  - Isi: Username, Email, Password, Role
  - Submit dan verifikasi user terbuat

- [ ] **Edit User**
  - Pilih user dari tabel
  - Klik tombol edit
  - Ubah role atau password
  - Submit dan verifikasi perubahan tersimpan

- [ ] **Hapus User**
  - Pilih user (bukan user yang sedang login)
  - Klik tombol hapus
  - Konfirmasi penghapusan
  - Verifikasi user terhapus

#### 1.10 Manajemen Lokasi

- [ ] **Buat Lokasi Baru**
  - Masuk ke halaman Finished Goods
  - Klik "Kelola Lokasi"
  - Klik "Tambah Lokasi"
  - Isi: Nama, Alamat (opsional)
  - Submit dan verifikasi lokasi terbuat

- [ ] **Edit Lokasi**
  - Pilih lokasi
  - Klik tombol edit
  - Ubah nama atau alamat
  - Submit dan verifikasi perubahan tersimpan

- [ ] **Hapus Lokasi**
  - Pilih lokasi yang tidak memiliki stok
  - Klik tombol hapus
  - Konfirmasi penghapusan
  - Verifikasi lokasi terhapus

---

### Role: OFFICE_PURCHASING

**Hak Akses:**

- ✅ Bahan Baku IN (pembelian)
- ✅ Produk Jadi IN (penerimaan dari produksi)
- ✅ Lihat laporan
- ❌ Tidak bisa: OUT movements, Batch, Adjustment, Edit/Delete movements

#### 2.1 Login sebagai OFFICE_PURCHASING

- [ ] Login dengan kredensial OFFICE_PURCHASING
- [ ] Verifikasi redirect ke halaman utama
- [ ] Verifikasi menu navigasi hanya menampilkan fitur yang diizinkan

#### 2.2 Manajemen Bahan Baku

- [ ] **Buat Bahan Baku Baru** ✅
  - Verifikasi bisa membuat bahan baku baru
  - Verifikasi bisa edit bahan baku

- [ ] **Hapus Bahan Baku** ❌
  - Verifikasi tombol hapus tidak muncul atau disabled
  - Atau verifikasi error message jika mencoba hapus

#### 2.3 Stok Masuk - Bahan Baku

- [ ] **Stok Masuk dengan Drum** ✅
  - Masuk ke halaman detail bahan baku
  - Klik "Tambah Stok Masuk"
  - Isi form dan submit
  - Verifikasi stok masuk berhasil
  - Verifikasi stok drum dan aggregate bertambah

- [ ] **Stok Masuk Multiple Drum** ✅
  - Gunakan fitur "Tambah Stok Masuk Drum"
  - Verifikasi bisa membuat multiple drum sekaligus

#### 2.4 Stok Keluar - Bahan Baku

- [ ] **Stok Keluar** ❌
  - Verifikasi tombol "Tambah Stok Keluar" tidak muncul
  - Atau verifikasi error message jika mencoba membuat OUT movement

#### 2.5 Stok Masuk - Produk Jadi

- [ ] **Stok Masuk ke Lokasi** ✅
  - Masuk ke halaman detail produk jadi
  - Klik "Tambah Stok Masuk"
  - Pilih lokasi dan isi form
  - Submit dan verifikasi stok masuk berhasil

#### 2.6 Stok Keluar - Produk Jadi

- [ ] **Stok Keluar** ❌
  - Verifikasi tombol "Tambah Stok Keluar" tidak muncul
  - Atau verifikasi error message jika mencoba membuat OUT movement

#### 2.7 Batch

- [ ] **Akses Halaman Batch** ❌
  - Verifikasi tidak bisa mengakses halaman Batches
  - Atau verifikasi error message jika mencoba akses

#### 2.8 Edit/Delete Movement

- [ ] **Edit Movement** ❌
  - Verifikasi tombol edit tidak muncul di movement history
  - Atau verifikasi error message jika mencoba edit

- [ ] **Hapus Movement** ❌
  - Verifikasi tombol hapus tidak muncul
  - Atau verifikasi error message jika mencoba hapus

#### 2.9 Laporan

- [ ] **Lihat Laporan** ✅
  - Masuk ke halaman Reports
  - Verifikasi bisa melihat laporan stok
  - Verifikasi bisa export laporan

#### 2.10 Manajemen User

- [ ] **Akses Halaman Users** ❌
  - Verifikasi tidak bisa mengakses halaman Users
  - Atau verifikasi error message

---

### Role: OFFICE_WAREHOUSE

**Hak Akses:**

- ✅ Bahan Baku OUT (untuk produksi)
- ✅ Produk Jadi OUT (distribusi)
- ✅ Batch (membuat batch produksi)
- ✅ Lihat laporan
- ❌ Tidak bisa: IN movements, Adjustment, Edit/Delete movements

#### 3.1 Login sebagai OFFICE_WAREHOUSE

- [ ] Login dengan kredensial OFFICE_WAREHOUSE
- [ ] Verifikasi redirect ke halaman utama
- [ ] Verifikasi menu navigasi hanya menampilkan fitur yang diizinkan

#### 3.2 Stok Masuk - Bahan Baku

- [ ] **Stok Masuk** ❌
  - Verifikasi tombol "Tambah Stok Masuk" tidak muncul
  - Atau verifikasi error message jika mencoba membuat IN movement

#### 3.3 Stok Keluar - Bahan Baku

- [ ] **Stok Keluar dari Drum** ✅
  - Masuk ke halaman detail bahan baku
  - Klik "Tambah Stok Keluar"
  - Pilih drum dan isi form
  - Submit dan verifikasi stok keluar berhasil
  - Verifikasi stok drum dan aggregate berkurang

#### 3.4 Stok Masuk - Produk Jadi

- [ ] **Stok Masuk** ❌
  - Verifikasi tombol "Tambah Stok Masuk" tidak muncul
  - Atau verifikasi error message

#### 3.5 Stok Keluar - Produk Jadi

- [ ] **Stok Keluar dari Lokasi** ✅
  - Masuk ke halaman detail produk jadi
  - Klik "Tambah Stok Keluar"
  - Pilih lokasi dan isi form
  - Submit dan verifikasi stok keluar berhasil

#### 3.6 Batch

- [ ] **Buat Batch Baru** ✅
  - Masuk ke halaman Batches
  - Klik "Tambah Batch"
  - Isi form dan tambah bahan baku
  - Submit dan verifikasi batch terbuat
  - Verifikasi stok bahan baku berkurang

- [ ] **Edit Batch** ❌
  - Verifikasi tombol edit tidak muncul
  - Atau verifikasi error message

- [ ] **Hapus Batch** ❌
  - Verifikasi tombol hapus tidak muncul
  - Atau verifikasi error message

#### 3.7 Edit/Delete Movement

- [ ] **Edit Movement** ❌
  - Verifikasi tombol edit tidak muncul
  - Atau verifikasi error message

- [ ] **Hapus Movement** ❌
  - Verifikasi tombol hapus tidak muncul
  - Atau verifikasi error message

#### 3.8 Laporan

- [ ] **Lihat Laporan** ✅
  - Masuk ke halaman Reports
  - Verifikasi bisa melihat laporan
  - Verifikasi bisa export laporan

---

## Pengujian Fitur Utama

### 4.1 Validasi Tanggal

#### 4.1.1 Tanggal Masa Depan

- [ ] **Bahan Baku - IN Movement**
  - Coba buat stok masuk dengan tanggal besok
  - Verifikasi error: "Movement date cannot be in the future"
  - Verifikasi movement tidak tersimpan

- [ ] **Bahan Baku - OUT Movement**
  - Coba buat stok keluar dengan tanggal besok
  - Verifikasi error message muncul
  - Verifikasi movement tidak tersimpan

- [ ] **Produk Jadi - IN Movement**
  - Coba buat stok masuk dengan tanggal besok
  - Verifikasi error message muncul

- [ ] **Produk Jadi - OUT Movement**
  - Coba buat stok keluar dengan tanggal besok
  - Verifikasi error message muncul

- [ ] **Batch**
  - Coba buat batch dengan tanggal besok
  - Verifikasi error message muncul

- [ ] **Edit Movement**
  - Edit movement dan ubah tanggal menjadi besok
  - Verifikasi error message muncul
  - Verifikasi perubahan tidak tersimpan

#### 4.1.2 Tanggal Hari Ini

- [ ] **Movement dengan Tanggal Hari Ini** ✅
  - Buat movement dengan tanggal hari ini
  - Verifikasi movement tersimpan
  - Verifikasi stok terupdate

#### 4.1.3 Tanggal Masa Lalu (Backdated)

- [ ] **Backdated Movement - Valid**
  - Buat movement dengan tanggal 1 minggu lalu
  - Pastikan stok cukup pada tanggal tersebut
  - Verifikasi movement tersimpan
  - Verifikasi stok terhitung dengan benar

- [ ] **Backdated Movement - Stok Tidak Cukup**
  - Buat OUT movement dengan tanggal 1 minggu lalu
  - Pastikan stok pada tanggal tersebut tidak cukup
  - Verifikasi error: "Insufficient stock"
  - Verifikasi movement tidak tersimpan

### 4.2 Validasi Jumlah (Quantity)

#### 4.2.1 Jumlah Nol

- [ ] **IN Movement dengan Jumlah 0**
  - Coba buat stok masuk dengan jumlah 0
  - Verifikasi error: "Quantity must be greater than zero"
  - Verifikasi movement tidak tersimpan

- [ ] **OUT Movement dengan Jumlah 0**
  - Coba buat stok keluar dengan jumlah 0
  - Verifikasi error message muncul

- [ ] **ADJUSTMENT dengan Jumlah 0**
  - Coba buat adjustment dengan jumlah 0
  - Verifikasi error message muncul

#### 4.2.2 Jumlah Negatif

- [ ] **IN Movement dengan Jumlah Negatif**
  - Coba buat stok masuk dengan jumlah negatif
  - Verifikasi error message muncul

- [ ] **OUT Movement dengan Jumlah Negatif**
  - Coba buat stok keluar dengan jumlah negatif
  - Verifikasi error message muncul

#### 4.2.3 Jumlah Sangat Besar

- [ ] **Movement dengan Jumlah > 1,000,000**
  - Coba buat movement dengan jumlah 1,000,001
  - Verifikasi error: "Quantity cannot exceed 1,000,000"
  - Verifikasi movement tidak tersimpan

### 4.3 Validasi Stok Negatif

#### 4.3.1 Stok Keluar Melebihi Stok Tersedia

- [ ] **Bahan Baku - Drum**
  - Pastikan drum memiliki stok 100
  - Coba keluarkan 150
  - Verifikasi error: "Insufficient stock"
  - Verifikasi stok tidak berubah

- [ ] **Bahan Baku - Aggregate**
  - Pastikan aggregate stok 200
  - Coba keluarkan 250
  - Verifikasi error message muncul

- [ ] **Produk Jadi - Lokasi**
  - Pastikan lokasi memiliki stok 50
  - Coba keluarkan 60
  - Verifikasi error message muncul

#### 4.3.2 Adjustment Negatif

- [ ] **Adjustment yang Menyebabkan Stok Negatif**
  - Pastikan stok drum 50
  - Coba adjustment dengan newStock = -10
  - Verifikasi error message muncul
  - Atau coba adjustment dengan quantity = -60
  - Verifikasi error message muncul

### 4.4 Perhitungan Stok Kronologis

#### 4.4.1 Movement Same-Day

- [ ] **Skenario: Multiple Movements pada Hari yang Sama**
  1. Buat IN movement tanggal hari ini, jam 10:00, jumlah 100
  2. Buat OUT movement tanggal hari ini, jam 11:00, jumlah 30
  3. Buat OUT movement tanggal hari ini, jam 09:00 (backdated), jumlah 20
  4. Verifikasi:
     - Movement #3 ditolak (stok tidak cukup pada jam 09:00)
     - Movement #1 dan #2 berhasil
     - Stok akhir = 100 - 30 = 70

- [ ] **Skenario: Movement Backdated pada Hari yang Sama**
  1. Buat IN movement tanggal hari ini, jam 10:00, jumlah 100
  2. Buat OUT movement tanggal hari ini, jam 09:00 (backdated), jumlah 50
  3. Verifikasi:
     - Movement #2 ditolak (stok tidak cukup pada jam 09:00)
     - Stok akhir = 100

#### 4.4.2 Movement Berurutan

- [ ] **Skenario: Movement Berurutan**
  1. Buat IN movement tanggal 1 Jan, jumlah 100
  2. Buat OUT movement tanggal 2 Jan, jumlah 30
  3. Buat OUT movement tanggal 3 Jan, jumlah 50
  4. Verifikasi:
     - Semua movement berhasil
     - Stok akhir = 100 - 30 - 50 = 20
     - Running balance di history benar

### 4.5 Konsistensi Stok Bahan Baku

#### 4.5.1 Aggregate = Sum of Drums

- [ ] **Verifikasi Konsistensi Setelah Stok Masuk**
  1. Buat stok masuk ke drum A: 50
  2. Buat stok masuk ke drum B: 30
  3. Verifikasi:
     - Aggregate stok = 80
     - Sum of drums = 50 + 30 = 80
     - Konsisten ✅

- [ ] **Verifikasi Konsistensi Setelah Stok Keluar**
  1. Keluarkan stok dari drum A: 20
  2. Verifikasi:
     - Drum A stok = 30
     - Aggregate stok = 60
     - Sum of drums = 30 + 30 = 60
     - Konsisten ✅

- [ ] **Verifikasi Konsistensi Setelah Batch**
  1. Buat batch yang menggunakan drum A: 10
  2. Verifikasi:
     - Drum A stok berkurang 10
     - Aggregate stok berkurang 10
     - Konsisten ✅

### 4.6 Stok Produk Jadi Berbasis Lokasi

#### 4.6.1 Stok Terpisah per Lokasi

- [ ] **Stok di Lokasi Berbeda**
  1. Buat stok masuk produk A ke Lokasi 1: 100
  2. Buat stok masuk produk A ke Lokasi 2: 50
  3. Verifikasi:
     - Stok di Lokasi 1 = 100
     - Stok di Lokasi 2 = 50
     - Stok di Lokasi 1 tidak terpengaruh oleh Lokasi 2

- [ ] **Stok Keluar dari Lokasi Tertentu**
  1. Keluarkan stok dari Lokasi 1: 30
  2. Verifikasi:
     - Stok di Lokasi 1 = 70
     - Stok di Lokasi 2 = 50 (tidak berubah)

#### 4.6.2 Transfer Antar Lokasi

- [ ] **Transfer dengan 2 Movement**
  1. Buat OUT movement dari Lokasi 1: 20
  2. Buat IN movement ke Lokasi 2: 20
  3. Verifikasi:
     - Stok di Lokasi 1 berkurang 20
     - Stok di Lokasi 2 bertambah 20
     - Total stok tetap sama

### 4.7 Pagination Movement History

#### 4.7.1 Pagination Bahan Baku

- [ ] **Halaman Pertama**
  - Masuk ke movement history bahan baku
  - Verifikasi menampilkan 50 movement terbaru (default)
  - Verifikasi running balance benar

- [ ] **Halaman Kedua**
  - Klik "Next" atau halaman 2
  - Verifikasi menampilkan movement berikutnya
  - Verifikasi running balance terhitung dengan benar (mengakomodasi movement di halaman sebelumnya)

- [ ] **Custom Limit**
  - Ubah limit menjadi 20
  - Verifikasi menampilkan 20 movement per halaman
  - Verifikasi pagination metadata benar (total, totalPages, hasMore)

#### 4.7.2 Pagination Produk Jadi

- [ ] **Pagination dengan Filter Lokasi**
  - Pilih lokasi tertentu
  - Verifikasi hanya menampilkan movement untuk lokasi tersebut
  - Verifikasi pagination bekerja dengan benar

### 4.8 Edit dan Hapus Movement

#### 4.8.1 Edit Movement - Perubahan Jumlah

- [ ] **Edit Jumlah IN Movement**
  1. Buat IN movement: 100
  2. Edit menjadi 150
  3. Verifikasi:
     - Stok bertambah 50 (selisih)
     - Movement history terupdate
     - Running balance terhitung ulang

- [ ] **Edit Jumlah OUT Movement**
  1. Buat OUT movement: 50
  2. Edit menjadi 30
  3. Verifikasi:
     - Stok bertambah 20 (karena OUT berkurang)
     - Movement history terupdate

#### 4.8.2 Edit Movement - Perubahan Tanggal

- [ ] **Edit Tanggal ke Masa Depan** ❌
  - Edit movement dan ubah tanggal menjadi besok
  - Verifikasi error message muncul

- [ ] **Edit Tanggal ke Masa Lalu**
  1. Buat movement tanggal hari ini
  2. Edit menjadi 1 minggu lalu
  3. Verifikasi:
     - Jika stok cukup pada tanggal baru: movement terupdate
     - Jika stok tidak cukup: error message muncul

#### 4.8.3 Edit Movement - Perubahan Lokasi (Produk Jadi)

- [ ] **Edit Lokasi**
  1. Buat IN movement ke Lokasi 1: 100
  2. Edit lokasi menjadi Lokasi 2
  3. Verifikasi:
     - Stok di Lokasi 1 dikembalikan (berkurang 100)
     - Stok di Lokasi 2 bertambah 100
     - Movement history terupdate

#### 4.8.4 Hapus Movement

- [ ] **Hapus IN Movement**
  1. Catat stok sebelum: X
  2. Buat IN movement: 50
  3. Hapus movement tersebut
  4. Verifikasi:
     - Stok kembali ke X
     - Movement terhapus dari history
     - Running balance terhitung ulang

- [ ] **Hapus OUT Movement**
  1. Catat stok sebelum: X
  2. Buat OUT movement: 30
  3. Hapus movement tersebut
  4. Verifikasi:
     - Stok kembali ke X + 30
     - Movement terhapus

### 4.9 Batch Operations

#### 4.9.1 Buat Batch

- [ ] **Batch dengan Multiple Bahan Baku**
  1. Buat batch dengan 2 bahan baku berbeda
  2. Setiap bahan baku menggunakan 1 drum
  3. Verifikasi:
     - Batch terbuat
     - Stok kedua bahan baku berkurang
     - Stok kedua drum berkurang
     - Movement OUT tercatat untuk setiap drum
     - Batch usage tercatat

- [ ] **Batch dengan Multiple Drum dari Bahan Baku Sama**
  1. Buat batch dengan 1 bahan baku
  2. Bahan baku menggunakan 2 drum berbeda
  3. Verifikasi:
     - Stok aggregate berkurang sesuai total
     - Stok kedua drum berkurang
     - Movement OUT tercatat untuk setiap drum

- [ ] **Batch dengan Stok Tidak Cukup**
  1. Coba buat batch yang menggunakan stok lebih besar dari tersedia
  2. Verifikasi error: "Insufficient stock"
  3. Verifikasi batch tidak terbuat
  4. Verifikasi stok tidak berubah

#### 4.9.2 Edit Batch

- [ ] **Edit Batch - Ubah Bahan Baku**
  1. Buat batch dengan bahan baku A: 50
  2. Edit batch, ganti dengan bahan baku B: 30
  3. Verifikasi:
     - Stok bahan baku A dikembalikan
     - Stok bahan baku B berkurang
     - Batch usage terupdate
     - Movement history terupdate

- [ ] **Edit Batch - Ubah Jumlah**
  1. Buat batch dengan bahan baku A: 50
  2. Edit menjadi 30
  3. Verifikasi:
     - Stok bahan baku A dikembalikan 20
     - Batch usage terupdate
     - Movement history terupdate

#### 4.9.3 Hapus Batch

- [ ] **Hapus Batch**
  1. Catat stok semua bahan baku sebelum batch
  2. Buat batch yang menggunakan beberapa bahan baku
  3. Hapus batch
  4. Verifikasi:
     - Stok semua bahan baku dikembalikan
     - Stok semua drum dikembalikan
     - Batch terhapus
     - Movement history terhapus
     - Batch usage terhapus

---

## Pengujian Edge Cases

### 5.1 Edge Cases - Tanggal

#### 5.1.1 Tanggal Batas

- [ ] **Movement dengan Tanggal 00:00:00**
  - Buat movement dengan tanggal hari ini jam 00:00:00
  - Verifikasi movement tersimpan

- [ ] **Movement dengan Tanggal 23:59:59**
  - Buat movement dengan tanggal hari ini jam 23:59:59
  - Verifikasi movement tersimpan

- [ ] **Multiple Movements pada Detik yang Sama**
  - Buat 2 movement pada waktu yang sama (atau sangat dekat)
  - Verifikasi keduanya tersimpan
  - Verifikasi urutan berdasarkan createdAt

#### 5.1.2 Timezone

- [ ] **Movement dengan Timezone WIB**
  - Verifikasi semua tanggal menggunakan timezone WIB
  - Buat movement dan verifikasi tanggal tersimpan dengan benar

### 5.2 Edge Cases - Jumlah

#### 5.2.1 Jumlah Desimal

- [ ] **Movement dengan Jumlah Desimal**
  - Buat IN movement dengan jumlah 10.5
  - Verifikasi stok bertambah 10.5
  - Verifikasi perhitungan akurat

- [ ] **Movement dengan Jumlah Desimal Banyak**
  - Buat movement dengan jumlah 10.123456
  - Verifikasi stok terhitung dengan benar (dibulatkan jika perlu)

#### 5.2.2 Jumlah Sangat Kecil

- [ ] **Movement dengan Jumlah 0.01**
  - Buat IN movement dengan jumlah 0.01
  - Verifikasi movement tersimpan
  - Verifikasi stok bertambah 0.01

### 5.3 Edge Cases - Stok

#### 5.3.1 Stok Nol

- [ ] **Stok Keluar hingga Nol**
  1. Pastikan stok drum = 50
  2. Keluarkan 50
  3. Verifikasi:
     - Stok drum = 0
     - Drum menjadi inactive (isActive = false)
     - Movement tersimpan

- [ ] **Stok Keluar Melebihi Stok (Edge Case)**
  1. Pastikan stok = 50.5
  2. Coba keluarkan 50.6
  3. Verifikasi error message muncul
  4. Verifikasi stok tetap 50.5

#### 5.3.2 Stok Sangat Besar

- [ ] **Movement dengan Jumlah Besar**
  - Buat IN movement dengan jumlah 999,999
  - Verifikasi movement tersimpan
  - Verifikasi stok terupdate

### 5.4 Edge Cases - Drum

#### 5.4.1 Drum dengan Stok Nol

- [ ] **Stok Masuk ke Drum Inactive**
  1. Pastikan drum memiliki stok 0 (inactive)
  2. Buat stok masuk ke drum tersebut
  3. Verifikasi:
     - Drum menjadi active
     - Stok drum bertambah
     - Aggregate stok bertambah

#### 5.4.2 Multiple Drum dengan Label Sama

- [ ] **Drum dengan Label Duplikat**
  1. Coba buat drum dengan label yang sudah ada
  2. Verifikasi error: "Drum ID already exists"
  3. Verifikasi drum tidak terbuat

### 5.5 Edge Cases - Lokasi

#### 5.5.1 Lokasi Tanpa Stok

- [ ] **Stok Keluar dari Lokasi Tanpa Stok**
  1. Pastikan lokasi tidak memiliki stok
  2. Coba keluarkan stok dari lokasi tersebut
  3. Verifikasi error: "Insufficient stock"
  4. Verifikasi stok tetap 0

#### 5.5.2 Lokasi Default

- [ ] **Lokasi Default**
  - Verifikasi ada lokasi yang ditandai sebagai default
  - Verifikasi lokasi default digunakan saat membuat produk jadi baru

### 5.6 Edge Cases - Batch

#### 5.6.1 Batch dengan Drum yang Sama

- [ ] **Batch Menggunakan Drum yang Sama 2 Kali**
  1. Coba buat batch yang menggunakan drum A dua kali
  2. Verifikasi error: "Duplicate drums found"
  3. Verifikasi batch tidak terbuat

#### 5.6.2 Batch dengan Bahan Baku yang Sama

- [ ] **Batch Menggunakan Bahan Baku yang Sama 2 Kali**
  1. Coba buat batch yang menggunakan bahan baku A dua kali
  2. Verifikasi error: "Duplicate materials found"
  3. Verifikasi batch tidak terbuat

#### 5.6.3 Batch dengan Kode Duplikat

- [ ] **Batch dengan Kode yang Sudah Ada**
  1. Buat batch dengan kode "BATCH-001"
  2. Coba buat batch lagi dengan kode "BATCH-001"
  3. Verifikasi error: "Batch code already exists"
  4. Verifikasi batch tidak terbuat

### 5.7 Edge Cases - Edit Movement

#### 5.7.1 Edit Movement yang Menyebabkan Stok Negatif

- [ ] **Edit Jumlah OUT Menjadi Lebih Besar**
  1. Buat OUT movement: 30 (stok tersisa 70)
  2. Edit menjadi 80
  3. Verifikasi error: "Insufficient stock"
  4. Verifikasi perubahan tidak tersimpan

#### 5.7.2 Edit Movement Batch-Linked

- [ ] **Edit Movement Batch-Linked**
  1. Buat batch yang menghasilkan movement
  2. Edit movement tersebut (ubah jumlah)
  3. Verifikasi:
     - Movement terupdate
     - Batch usage terupdate
     - Stok terupdate dengan benar

### 5.8 Edge Cases - Hapus Movement

#### 5.8.1 Hapus Movement yang Menyebabkan Inconsistency

- [ ] **Hapus Movement Batch-Linked**
  1. Buat batch
  2. Hapus salah satu movement dari batch
  3. Verifikasi:
     - Movement terhapus
     - Batch usage terhapus
     - Stok dikembalikan
     - Batch masih ada (jika ada movement lain)

#### 5.8.2 Hapus Movement yang Menyebabkan Stok Negatif

- [ ] **Hapus IN Movement yang Menyebabkan OUT Tidak Valid**
  1. Buat IN movement: 100
  2. Buat OUT movement: 80
  3. Hapus IN movement
  4. Verifikasi:
     - IN movement terhapus
     - OUT movement masih ada
     - Stok menjadi negatif? (Ini seharusnya tidak terjadi karena validasi)

---

## Pengujian Logika Bisnis

### 6.1 Logika Perhitungan Stok

#### 6.1.1 Perhitungan Kronologis

- [ ] **Verifikasi Urutan Movement**
  1. Buat movement dengan urutan:
     - 1 Jan: IN 100
     - 2 Jan: OUT 30
     - 3 Jan: IN 50
     - 4 Jan: OUT 20
  2. Verifikasi running balance:
     - 1 Jan: 100
     - 2 Jan: 70
     - 3 Jan: 120
     - 4 Jan: 100

#### 6.1.2 Perhitungan Same-Day

- [ ] **Verifikasi Urutan Same-Day**
  1. Buat movement pada hari yang sama:
     - 10:00: IN 100
     - 11:00: OUT 30
     - 12:00: IN 50
  2. Verifikasi running balance:
     - 10:00: 100
     - 11:00: 70
     - 12:00: 120

### 6.2 Logika Konsistensi Bahan Baku

#### 6.2.1 Aggregate = Sum of Drums

- [ ] **Verifikasi Setelah Setiap Operasi**
  - Setelah stok masuk: verifikasi konsistensi
  - Setelah stok keluar: verifikasi konsistensi
  - Setelah batch: verifikasi konsistensi
  - Setelah edit movement: verifikasi konsistensi
  - Setelah hapus movement: verifikasi konsistensi

#### 6.2.2 Drum Active Status

- [ ] **Verifikasi isActive**
  1. Buat drum dengan stok 0
  2. Verifikasi isActive = false
  3. Tambah stok 10
  4. Verifikasi isActive = true
  5. Keluarkan semua stok
  6. Verifikasi isActive = false

### 6.3 Logika Stok Produk Jadi

#### 6.3.1 Stok Berbasis Lokasi

- [ ] **Verifikasi Stok Terpisah**
  1. Buat stok masuk ke Lokasi 1: 100
  2. Buat stok masuk ke Lokasi 2: 50
  3. Verifikasi:
     - Stok Lokasi 1 = 100
     - Stok Lokasi 2 = 50
     - Tidak ada stok global

#### 6.3.2 Transfer Lokasi

- [ ] **Verifikasi Transfer**
  1. Buat stok masuk ke Lokasi 1: 100
  2. Buat OUT dari Lokasi 1: 30
  3. Buat IN ke Lokasi 2: 30
  4. Verifikasi:
     - Stok Lokasi 1 = 70
     - Stok Lokasi 2 = 30
     - Total stok = 100 (tidak berubah)

### 6.4 Logika Adjustment

#### 6.4.1 Adjustment dengan newStock

- [ ] **Verifikasi Perhitungan**
  1. Pastikan stok saat ini = 100
  2. Buat adjustment dengan newStock = 150
  3. Verifikasi:
     - Movement quantity = 50 (150 - 100)
     - Stok menjadi 150

- [ ] **Adjustment Negatif dengan newStock**
  1. Pastikan stok = 100
  2. Buat adjustment dengan newStock = 30
  3. Verifikasi:
     - Movement quantity = -70 (30 - 100)
     - Stok menjadi 30

#### 6.4.2 Adjustment dengan quantity

- [ ] **Adjustment Positif**
  1. Pastikan stok = 100
  2. Buat adjustment dengan quantity = 20
  3. Verifikasi stok menjadi 120

- [ ] **Adjustment Negatif**
  1. Pastikan stok = 100
  2. Buat adjustment dengan quantity = -30
  3. Verifikasi stok menjadi 70

### 6.5 Logika Batch

#### 6.5.1 Batch Mengurangi Stok

- [ ] **Verifikasi Pengurangan Stok**
  1. Catat stok awal: Drum A = 100, Drum B = 50
  2. Buat batch menggunakan: Drum A = 30, Drum B = 20
  3. Verifikasi:
     - Drum A = 70
     - Drum B = 30
     - Aggregate bahan baku A berkurang 30
     - Aggregate bahan baku B berkurang 20

#### 6.5.2 Batch dengan Multiple Drum dari Bahan Baku Sama

- [ ] **Verifikasi Aggregate**
  1. Bahan baku A memiliki: Drum 1 = 50, Drum 2 = 30
  2. Buat batch menggunakan: Drum 1 = 20, Drum 2 = 10
  3. Verifikasi:
     - Aggregate bahan baku A berkurang 30 (total)
     - Drum 1 = 30
     - Drum 2 = 20

---

## Checklist Pengujian

### Checklist Umum

- [ ] **Tidak ada Error di Console**
  - Buka Developer Tools (F12)
  - Navigasi ke semua halaman
  - Verifikasi tidak ada error di console

- [ ] **Tidak ada Error di Network**
  - Buka tab Network di Developer Tools
  - Lakukan beberapa operasi
  - Verifikasi semua request berhasil (status 200/201)
  - Verifikasi tidak ada request yang gagal (status 400/500)

- [ ] **UI Responsif**
  - Test di berbagai ukuran layar
  - Verifikasi layout tidak rusak
  - Verifikasi semua tombol dan form dapat diakses

- [ ] **Loading States**
  - Verifikasi loading indicator muncul saat fetch data
  - Verifikasi loading indicator hilang setelah data loaded

- [ ] **Error Messages**
  - Verifikasi error message muncul dengan jelas
  - Verifikasi error message dalam Bahasa Indonesia
  - Verifikasi error message informatif

### Checklist Per Role

#### ADMIN

- [ ] Semua fitur dapat diakses
- [ ] Dapat membuat, edit, hapus semua data
- [ ] Dapat membuat semua jenis movement
- [ ] Dapat edit dan hapus movement
- [ ] Dapat mengelola user

#### OFFICE_PURCHASING

- [ ] Hanya dapat membuat IN movements
- [ ] Tidak dapat membuat OUT movements
- [ ] Tidak dapat membuat batch
- [ ] Tidak dapat edit/hapus movement
- [ ] Dapat melihat laporan

#### OFFICE_WAREHOUSE

- [ ] Hanya dapat membuat OUT movements
- [ ] Dapat membuat batch
- [ ] Tidak dapat membuat IN movements
- [ ] Tidak dapat edit/hapus movement
- [ ] Dapat melihat laporan

### Checklist Validasi

- [ ] Semua validasi tanggal masa depan bekerja
- [ ] Semua validasi jumlah nol bekerja
- [ ] Semua validasi stok negatif bekerja
- [ ] Semua validasi stok tidak cukup bekerja
- [ ] Semua validasi field wajib bekerja

### Checklist Konsistensi Data

- [ ] Aggregate stok bahan baku = sum of drums (setelah setiap operasi)
- [ ] Stok produk jadi terpisah per lokasi
- [ ] Running balance di history benar
- [ ] Movement history lengkap dan akurat

### Checklist Edge Cases

- [ ] Tanggal batas (00:00:00, 23:59:59)
- [ ] Jumlah desimal
- [ ] Jumlah sangat kecil (0.01)
- [ ] Stok nol
- [ ] Drum inactive
- [ ] Lokasi tanpa stok
- [ ] Batch dengan data duplikat
- [ ] Edit/hapus movement yang menyebabkan masalah

---

## Catatan Penting

### 1. Data Test

- Gunakan data test yang berbeda untuk setiap sesi pengujian
- Jangan gunakan data produksi untuk pengujian
- Backup database sebelum pengujian ekstensif

### 2. Dokumentasi Bug

- Catat semua bug yang ditemukan dengan detail:
  - Langkah reproduksi
  - Expected behavior
  - Actual behavior
  - Screenshot (jika perlu)
  - Browser dan versi
  - Role yang digunakan

### 3. Verifikasi Perhitungan

- Gunakan kalkulator untuk verifikasi perhitungan stok
- Verifikasi running balance secara manual
- Verifikasi aggregate = sum of drums secara manual

### 4. Pengujian Regression

- Setelah bug diperbaiki, uji kembali semua fitur terkait
- Pastikan perbaikan tidak menyebabkan bug baru

### 5. Pengujian Performance

- Test dengan data besar (1000+ movements)
- Verifikasi pagination bekerja dengan baik
- Verifikasi tidak ada lag saat navigasi

---

## Kesimpulan

Panduan ini mencakup pengujian menyeluruh untuk semua fitur, role, dan edge cases. Pastikan untuk:

1. ✅ Mengikuti urutan pengujian
2. ✅ Mencatat semua hasil pengujian
3. ✅ Melaporkan bug dengan detail lengkap
4. ✅ Verifikasi perbaikan bug
5. ✅ Melakukan pengujian regression

**Selamat Menguji!** 🧪
