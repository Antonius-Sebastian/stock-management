/**
 * Help Content Configuration
 *
 * Centralized help documentation for the application.
 * All content is RBAC-aware and filtered based on user roles.
 */

import type { UserRole } from '@/lib/rbac'
import type { Step } from 'react-joyride'

// Extended Step type with RBAC support
export interface TourStep extends Step {
  requiredRole?: UserRole
}

export interface HelpVideo {
  youtubeId: string
  title: string
  description: string
  duration: string
  thumbnail?: string
}

export interface HelpSection {
  id: string
  title: string
  content: string // Markdown content
  requiredRole?: UserRole | null // null = all roles can see
  screenshot?: string
}

export interface HelpGuide {
  id: string
  page: string
  title: string
  description: string
  requiredRole?: UserRole | null // null = all roles can see
  quickSteps: string[]
  tourSteps: TourStep[]
  video?: HelpVideo
  sections: HelpSection[]
}

/**
 * Get help guides filtered by user role
 */
export function getHelpGuidesForRole(role: UserRole | undefined): HelpGuide[] {
  if (!role) return []

  return Object.values(helpGuides).filter((guide) => {
    // If no requiredRole specified, all roles can see it
    if (!guide.requiredRole) return true
    // If ADMIN, can see everything
    if (role === 'ADMIN') return true
    // Otherwise, must match role
    return guide.requiredRole === role
  })
}

/**
 * Get help guide for a specific page
 */
export function getHelpGuideForPage(
  page: string,
  role?: UserRole
): HelpGuide | undefined {
  const guide = Object.values(helpGuides).find((g) => g.page === page)
  if (!guide) return undefined

  // Check RBAC
  if (
    role &&
    guide.requiredRole &&
    guide.requiredRole !== role &&
    role !== 'ADMIN'
  ) {
    return undefined
  }

  return guide
}

/**
 * Filter tour steps based on user role
 */
export function filterTourStepsForRole(
  steps: TourStep[],
  role: UserRole | undefined
): Step[] {
  if (!role) return []

  // Filter steps that have role requirements
  return steps.filter((step) => {
    const stepRole = step.requiredRole
    if (!stepRole) return true
    if (role === 'ADMIN') return true
    return stepRole === role
  })
}

// Dummy screenshot placeholder
const SCREENSHOT_PLACEHOLDER =
  'https://via.placeholder.com/800x600/4F46E5/FFFFFF?text=Screenshot+Placeholder'

// Dummy YouTube video IDs (replace with real videos later)
const DUMMY_VIDEO_ID = 'dQw4w9WgXcQ' // Rick Roll as placeholder

/**
 * Help Guides Configuration
 */
export const helpGuides: Record<string, HelpGuide> = {
  'raw-materials': {
    id: 'raw-materials',
    page: '/raw-materials',
    title: 'Panduan Bahan Baku',
    description: 'Pelajari cara mengelola bahan baku di sistem inventory',
    requiredRole: null, // All roles can see
    quickSteps: [
      'Klik "Tambah Bahan Baku" untuk menambah item baru',
      'Klik nama bahan baku untuk melihat detail dan riwayat pergerakan stok',
      'Gunakan tombol "Stok Masuk" atau "Stok Keluar" untuk mengubah stok',
      'Indikator warna menunjukkan status stok: Hijau (aman), Kuning (menipis), Merah (habis)',
    ],
    tourSteps: [
      {
        target: 'body',
        content:
          'Selamat datang di halaman Bahan Baku! Di sini Anda dapat melihat dan mengelola semua bahan baku yang ada di sistem.',
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: '[data-tour="add-raw-material"]',
        content: 'Klik tombol ini untuk menambahkan bahan baku baru ke sistem.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="raw-materials-table"]',
        content:
          'Tabel ini menampilkan semua bahan baku. Klik pada nama bahan baku untuk melihat detail lengkap dan riwayat pergerakan stok.',
        placement: 'top',
      },
      {
        target: '[data-tour="stock-badge"]',
        content:
          'Indikator warna menunjukkan status stok: Hijau (stok aman), Kuning (stok menipis), Merah (stok habis atau sangat rendah).',
        placement: 'right',
      },
    ],
    video: {
      youtubeId: DUMMY_VIDEO_ID,
      title: 'Cara Mengelola Bahan Baku',
      description:
        'Video tutorial lengkap tentang cara menambah, mengedit, dan mengelola bahan baku di sistem.',
      duration: '5:30',
    },
    sections: [
      {
        id: 'viewing-materials',
        title: 'Melihat Daftar Bahan Baku',
        content: `## Melihat Daftar Bahan Baku

Halaman Bahan Baku menampilkan semua bahan baku yang ada di sistem inventory Anda.

![Screenshot Daftar Bahan Baku](${SCREENSHOT_PLACEHOLDER})

### Indikator Stok

Sistem menggunakan warna untuk menunjukkan status stok:

- 🟢 **Hijau**: Stok aman (di atas Minimum Order Quantity/MOQ)
- 🟡 **Kuning**: Stok menipis (di bawah MOQ, perlu pemesanan)
- 🔴 **Merah**: Stok habis atau sangat rendah (perlu segera dipesan)

### Cara Menggunakan

1. Buka menu **"Bahan Baku"** di sidebar kiri
2. Anda akan melihat tabel dengan semua bahan baku
3. Setiap baris menampilkan:
   - Kode bahan baku
   - Nama bahan baku
   - Satuan (kg, liter, dll)
   - Stok saat ini
   - Status stok (indikator warna)
4. Klik pada **nama bahan baku** untuk melihat detail lengkap dan riwayat pergerakan stok`,
        screenshot: SCREENSHOT_PLACEHOLDER,
      },
      {
        id: 'adding-material',
        title: 'Menambah Bahan Baku Baru',
        content: `## Menambah Bahan Baku Baru

Gunakan fitur ini ketika Anda ingin menambahkan bahan baku baru ke sistem.

![Screenshot Form Tambah Bahan Baku](${SCREENSHOT_PLACEHOLDER})

### Langkah-langkah:

1. Klik tombol **"Tambah Bahan Baku"** di pojok kanan atas halaman
2. Form akan muncul, isi informasi berikut:
   - **Kode**: Masukkan kode unik untuk bahan baku (contoh: BB-001, BB-002)
   - **Nama**: Masukkan nama lengkap bahan baku
   - **Satuan**: Pilih satuan yang digunakan (kg, liter, gram, dll)
   - **MOQ (Minimum Order Quantity)**: Masukkan jumlah minimum yang harus ada di gudang
   - **Stok Awal**: Masukkan jumlah stok awal saat ini
3. Klik **"Buat"** untuk menyimpan bahan baku baru

### Tips:

- Gunakan kode yang mudah diingat dan konsisten
- MOQ membantu sistem memberikan peringatan ketika stok menipis
- Stok awal akan digunakan sebagai baseline untuk perhitungan selanjutnya`,
        screenshot: SCREENSHOT_PLACEHOLDER,
        requiredRole: 'OFFICE_PURCHASING', // Only OFFICE and ADMIN can add materials
      },
      {
        id: 'stock-movements',
        title: 'Mengelola Pergerakan Stok',
        content: `## Mengelola Pergerakan Stok

Anda dapat mencatat stok masuk (pembelian) atau stok keluar (penggunaan) untuk setiap bahan baku.

![Screenshot Pergerakan Stok](${SCREENSHOT_PLACEHOLDER})

### Stok Masuk (IN)

Digunakan ketika bahan baku baru datang (misalnya dari supplier):

1. Klik tombol **"Stok Masuk"** pada bahan baku yang ingin ditambah
2. Masukkan jumlah yang masuk
3. Masukkan tanggal (default: hari ini)
4. Tambahkan deskripsi jika perlu (opsional)
5. Klik **"Simpan"**

### Stok Keluar (OUT)

**Catatan Penting**: Stok keluar untuk bahan baku biasanya terjadi otomatis saat membuat batch produksi. Jika perlu mencatat stok keluar manual, hubungi admin.

### Melihat Riwayat

1. Klik pada **nama bahan baku** di tabel
2. Scroll ke bagian **"Riwayat Pergerakan Stok"**
3. Anda akan melihat semua transaksi dengan:
   - Tanggal
   - Jenis (Masuk/Keluar)
   - Jumlah
   - Stok setelah transaksi
   - Keterangan`,
        screenshot: SCREENSHOT_PLACEHOLDER,
      },
    ],
  },

  'finished-goods': {
    id: 'finished-goods',
    page: '/finished-goods',
    title: 'Panduan Produk Jadi',
    description: 'Pelajari cara mengelola produk jadi di sistem inventory',
    requiredRole: null,
    quickSteps: [
      'Klik "Tambah Produk Jadi" untuk menambah produk baru',
      'Klik nama produk untuk melihat detail dan riwayat',
      'Gunakan "Stok Masuk" untuk menambah stok (biasanya otomatis dari batch)',
      'Gunakan "Stok Keluar" untuk mencatat pengiriman ke distributor',
    ],
    tourSteps: [
      {
        target: 'body',
        content:
          'Ini adalah halaman Produk Jadi. Di sini Anda mengelola semua produk jadi yang diproduksi.',
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: '[data-tour="add-finished-good"]',
        content: 'Klik tombol ini untuk menambahkan produk jadi baru.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="finished-goods-table"]',
        content:
          'Tabel ini menampilkan semua produk jadi. Klik pada nama untuk melihat detail.',
        placement: 'top',
      },
    ],
    video: {
      youtubeId: DUMMY_VIDEO_ID,
      title: 'Cara Mengelola Produk Jadi',
      description:
        'Video tutorial tentang cara menambah dan mengelola produk jadi.',
      duration: '4:15',
    },
    sections: [
      {
        id: 'viewing-finished-goods',
        title: 'Melihat Daftar Produk Jadi',
        content: `## Melihat Daftar Produk Jadi

Halaman ini menampilkan semua produk jadi yang ada di sistem.

![Screenshot Daftar Produk Jadi](${SCREENSHOT_PLACEHOLDER})

### Informasi yang Ditampilkan

- Kode produk
- Nama produk
- Satuan
- Stok saat ini
- Status stok (indikator warna)`,
      },
      {
        id: 'adding-finished-good',
        title: 'Menambah Produk Jadi Baru',
        content: `## Menambah Produk Jadi Baru

![Screenshot Form Tambah Produk Jadi](${SCREENSHOT_PLACEHOLDER})

### Langkah-langkah:

1. Klik **"Tambah Produk Jadi"**
2. Isi form:
   - Kode produk
   - Nama produk
   - Satuan
   - MOQ
   - Stok awal
3. Klik **"Buat"**`,
        requiredRole: 'OFFICE_PURCHASING',
      },
    ],
  },

  batches: {
    id: 'batches',
    page: '/batches',
    title: 'Panduan Pemakaian Batch',
    description: 'Pelajari cara membuat dan mengelola batch produksi',
    requiredRole: null,
    quickSteps: [
      'Klik "Catat Pemakaian Baru" untuk membuat batch baru',
      'Pilih bahan baku yang digunakan dan masukkan jumlahnya',
      'Setelah batch dibuat, klik "Tambah Produk Jadi" untuk mencatat hasil produksi',
      'Klik pada batch untuk melihat detail lengkap',
    ],
    tourSteps: [
      {
        target: 'body',
        content:
          'Selamat datang di halaman Pemakaian Batch! Di sini Anda mencatat penggunaan bahan baku untuk produksi.',
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: '[data-tour="create-batch"]',
        content:
          'Klik tombol ini untuk membuat batch produksi baru. Sistem akan otomatis mengurangi stok bahan baku yang digunakan.',
        placement: 'bottom',
        requiredRole: 'OFFICE_WAREHOUSE', // Only show to FACTORY and ADMIN
      },
      {
        target: '[data-tour="batches-table"]',
        content:
          'Tabel ini menampilkan semua batch yang pernah dibuat. Klik pada batch untuk melihat detail lengkap.',
        placement: 'top',
      },
      {
        target: '[data-tour="add-finished-goods"]',
        content:
          'Setelah batch dibuat, klik tombol ini untuk menambahkan produk jadi yang dihasilkan dari batch tersebut.',
        placement: 'left',
        requiredRole: 'OFFICE_WAREHOUSE',
      },
    ],
    video: {
      youtubeId: DUMMY_VIDEO_ID,
      title: 'Cara Membuat Batch Produksi',
      description:
        'Video tutorial lengkap tentang cara membuat batch dan mencatat hasil produksi.',
      duration: '6:45',
    },
    sections: [
      {
        id: 'creating-batch',
        title: 'Membuat Batch Produksi Baru',
        content: `## Membuat Batch Produksi Baru

**Kapan menggunakan:** Ketika Anda ingin mencatat penggunaan bahan baku untuk produksi.

![Screenshot Form Buat Batch](${SCREENSHOT_PLACEHOLDER})

### Langkah-langkah:

1. Klik tombol **"Catat Pemakaian Baru"** (hijau, di pojok kanan atas)
2. Isi informasi batch:
   - **Kode Batch**: Masukkan kode unik (contoh: BATCH-2025-001)
   - **Tanggal**: Pilih tanggal produksi
   - **Deskripsi**: (Opsional) Tambahkan catatan jika perlu
3. Tambahkan bahan baku yang digunakan:
   - Klik **"Pilih bahan baku"** dan pilih dari daftar
   - Masukkan **jumlah** yang digunakan
   - Sistem akan menampilkan stok tersedia
   - Klik **"Tambah Bahan Baku"** jika perlu menambah lebih banyak
4. Klik **"Buat Batch"** untuk menyimpan

### Catatan Penting:

- ✅ Sistem akan **otomatis mengurangi stok** bahan baku yang digunakan
- ✅ Pastikan stok bahan baku cukup sebelum membuat batch
- ✅ Produk jadi dapat ditambahkan setelah batch dibuat (langkah terpisah)
- ⚠️ Batch tidak dapat diubah setelah dibuat (kecuali oleh Admin)`,
        screenshot: SCREENSHOT_PLACEHOLDER,
        requiredRole: 'OFFICE_WAREHOUSE',
      },
      {
        id: 'adding-finished-goods',
        title: 'Menambahkan Produk Jadi ke Batch',
        content: `## Menambahkan Produk Jadi ke Batch

Setelah batch dibuat, Anda perlu menambahkan produk jadi yang dihasilkan.

![Screenshot Tambah Produk Jadi ke Batch](${SCREENSHOT_PLACEHOLDER})

### Langkah-langkah:

1. Setelah batch dibuat, klik tombol **"Tambah Produk Jadi"** pada batch tersebut
2. Form akan muncul, pilih produk jadi yang dihasilkan
3. Masukkan **jumlah** produk jadi yang dihasilkan
4. Klik **"Tambah"** untuk menyimpan

### Catatan:

- Sistem akan **otomatis menambah stok** produk jadi
- Anda dapat menambahkan lebih dari satu produk jadi per batch
- Pastikan produk jadi sudah terdaftar di sistem sebelumnya`,
        screenshot: SCREENSHOT_PLACEHOLDER,
        requiredRole: 'OFFICE_WAREHOUSE',
      },
      {
        id: 'viewing-batch-details',
        title: 'Melihat Detail Batch',
        content: `## Melihat Detail Batch

Klik pada batch di tabel untuk melihat informasi lengkap.

![Screenshot Detail Batch](${SCREENSHOT_PLACEHOLDER})

### Informasi yang Ditampilkan:

- Kode batch dan tanggal
- Bahan baku yang digunakan (dengan jumlah)
- Produk jadi yang dihasilkan (dengan jumlah)
- Status batch
- Deskripsi (jika ada)`,
      },
      {
        id: 'editing-batch',
        title: 'Mengedit Batch (Admin Only)',
        content: `## Mengedit Batch

**Hanya Admin yang dapat mengedit batch.** Fitur ini digunakan untuk koreksi data.

![Screenshot Edit Batch](${SCREENSHOT_PLACEHOLDER})

### Catatan:

- Mengedit batch akan mempengaruhi stok
- Gunakan dengan hati-hati
- Pastikan data yang diubah sudah benar`,
        screenshot: SCREENSHOT_PLACEHOLDER,
        requiredRole: 'ADMIN',
      },
    ],
  },

  reports: {
    id: 'reports',
    page: '/reports',
    title: 'Panduan Laporan Stok',
    description: 'Pelajari cara melihat dan mengekspor laporan stok',
    requiredRole: null,
    quickSteps: [
      'Pilih bulan dan tahun yang ingin dilihat',
      'Pilih jenis item (Bahan Baku atau Produk Jadi)',
      'Pilih tipe data (Stok Awal, Masuk, Keluar, atau Sisa)',
      'Klik "Export Excel" untuk mengunduh laporan',
    ],
    tourSteps: [
      {
        target: 'body',
        content:
          'Ini adalah halaman Laporan Stok. Di sini Anda dapat melihat ringkasan stok dalam bentuk tabel pivot.',
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: '[data-tour="report-filters"]',
        content:
          'Gunakan filter ini untuk memilih periode dan jenis laporan yang ingin dilihat.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="export-button"]',
        content: 'Klik tombol ini untuk mengekspor laporan ke file Excel.',
        placement: 'left',
      },
    ],
    video: {
      youtubeId: DUMMY_VIDEO_ID,
      title: 'Cara Membaca Laporan Stok',
      description:
        'Video tutorial tentang cara membaca dan mengekspor laporan stok.',
      duration: '5:00',
    },
    sections: [
      {
        id: 'viewing-reports',
        title: 'Melihat Laporan Stok',
        content: `## Melihat Laporan Stok

Halaman laporan menampilkan data stok dalam bentuk tabel pivot yang mudah dibaca.

![Screenshot Laporan Stok](${SCREENSHOT_PLACEHOLDER})

### Filter yang Tersedia:

1. **Bulan dan Tahun**: Pilih periode yang ingin dilihat
2. **Jenis Item**: 
   - Bahan Baku
   - Produk Jadi
3. **Tipe Data**:
   - **Stok Awal**: Stok di awal bulan
   - **Masuk**: Stok yang masuk selama bulan tersebut
   - **Keluar**: Stok yang keluar selama bulan tersebut
   - **Sisa**: Stok di akhir bulan

### Cara Membaca Tabel:

- Setiap baris = satu item (bahan baku atau produk jadi)
- Setiap kolom = satu hari dalam bulan
- Angka di sel = jumlah stok pada hari tersebut`,
        screenshot: SCREENSHOT_PLACEHOLDER,
      },
      {
        id: 'exporting-reports',
        title: 'Mengekspor Laporan ke Excel',
        content: `## Mengekspor Laporan ke Excel

Anda dapat mengunduh laporan dalam format Excel untuk analisis lebih lanjut.

![Screenshot Export Excel](${SCREENSHOT_PLACEHOLDER})

### Langkah-langkah:

1. Atur filter sesuai kebutuhan (bulan, tahun, jenis item, tipe data)
2. Klik tombol **"Export Excel"**
3. File Excel akan terunduh otomatis
4. Buka file di Microsoft Excel atau aplikasi spreadsheet lainnya

### Catatan:

- File Excel berisi semua data yang terlihat di tabel
- Format file: .xlsx (Excel 2007+)
- File dapat dibuka di Google Sheets juga`,
        screenshot: SCREENSHOT_PLACEHOLDER,
      },
    ],
  },

  users: {
    id: 'users',
    page: '/users',
    title: 'Panduan Manajemen User',
    description: 'Pelajari cara mengelola user dan hak akses',
    requiredRole: 'ADMIN', // Only ADMIN can see this
    quickSteps: [
      'Klik "Tambah User" untuk membuat user baru',
      'Pilih role: ADMIN (penuh), FACTORY (produksi), atau OFFICE (kantor)',
      'Klik pada user untuk mengedit atau nonaktifkan',
      'Hanya Admin yang dapat mengakses halaman ini',
    ],
    tourSteps: [
      {
        target: 'body',
        content:
          'Ini adalah halaman Manajemen User. Hanya Admin yang dapat mengakses halaman ini.',
        placement: 'center',
        disableBeacon: true,
        requiredRole: 'ADMIN',
      },
      {
        target: '[data-tour="add-user"]',
        content: 'Klik tombol ini untuk menambahkan user baru ke sistem.',
        placement: 'bottom',
        requiredRole: 'ADMIN',
      },
      {
        target: '[data-tour="users-table"]',
        content:
          'Tabel ini menampilkan semua user. Klik pada user untuk mengedit atau mengubah status.',
        placement: 'top',
        requiredRole: 'ADMIN',
      },
    ],
    video: {
      youtubeId: DUMMY_VIDEO_ID,
      title: 'Cara Mengelola User',
      description:
        'Video tutorial untuk admin tentang cara menambah dan mengelola user.',
      duration: '4:30',
    },
    sections: [
      {
        id: 'adding-user',
        title: 'Menambah User Baru',
        content: `## Menambah User Baru

**Hanya Admin yang dapat menambah user baru.**

![Screenshot Form Tambah User](${SCREENSHOT_PLACEHOLDER})

### Langkah-langkah:

1. Klik **"Tambah User"**
2. Isi form:
   - **Username**: Nama pengguna (unik, tidak boleh duplikat)
   - **Password**: Minimal 8 karakter, harus ada huruf besar, huruf kecil, dan angka
   - **Nama**: Nama lengkap user
   - **Email**: (Opsional) Email user
   - **Role**: Pilih salah satu:
     - **ADMIN**: Akses penuh ke semua fitur
     - **FACTORY**: Dapat membuat batch produksi
     - **OFFICE**: Dapat mengelola bahan baku dan produk jadi, input stok masuk/keluar
3. Klik **"Buat"** untuk menyimpan

### Tips:

- Username tidak dapat diubah setelah dibuat
- Password dapat diubah oleh admin
- Role menentukan fitur apa yang dapat diakses user`,
        screenshot: SCREENSHOT_PLACEHOLDER,
        requiredRole: 'ADMIN',
      },
      {
        id: 'editing-user',
        title: 'Mengedit User',
        content: `## Mengedit User

Anda dapat mengubah informasi user atau menonaktifkan user.

![Screenshot Edit User](${SCREENSHOT_PLACEHOLDER})

### Yang Dapat Diubah:

- Nama
- Email
- Password
- Role
- Status aktif/nonaktif

### Catatan:

- Username tidak dapat diubah
- User yang dinonaktifkan tidak dapat login`,
        screenshot: SCREENSHOT_PLACEHOLDER,
        requiredRole: 'ADMIN',
      },
    ],
  },
}
