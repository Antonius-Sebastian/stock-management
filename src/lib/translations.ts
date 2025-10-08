/**
 * Translations for UI text from English to Bahasa Indonesia
 */

export const translations = {
  // Common
  loading: 'Memuat...',
  save: 'Simpan',
  cancel: 'Batal',
  delete: 'Hapus',
  edit: 'Edit',
  add: 'Tambah',
  search: 'Cari',
  filter: 'Filter',
  export: 'Ekspor',
  actions: 'Aksi',
  confirm: 'Konfirmasi',

  // Navigation
  rawMaterials: 'Bahan Baku',
  finishedGoods: 'Produk Jadi',
  batchUsage: 'Pemakaian Batch',
  stockReports: 'Laporan Stok',
  userManagement: 'Manajemen User',

  // Raw Materials
  rawMaterialsTitle: 'Bahan Baku',
  rawMaterialsDescription: 'Kelola inventori bahan baku Anda',
  rawMaterialsInventory: 'Inventori Bahan Baku',
  rawMaterialsInventoryDescription: 'Lihat dan kelola semua bahan baku dengan indikator level stok',
  addRawMaterial: 'Tambah Bahan Baku',
  editRawMaterial: 'Edit Bahan Baku',
  deleteRawMaterial: 'Hapus Bahan Baku',

  // Finished Goods
  finishedGoodsTitle: 'Produk Jadi',
  finishedGoodsDescription: 'Kelola inventori produk jadi Anda',
  finishedGoodsInventory: 'Inventori Produk Jadi',
  finishedGoodsInventoryDescription: 'Lihat dan kelola semua produk jadi',
  addFinishedGood: 'Tambah Produk Jadi',
  editFinishedGood: 'Edit Produk Jadi',
  deleteFinishedGood: 'Hapus Produk Jadi',

  // Stock Entry
  stockIn: 'Stok Masuk',
  stockOut: 'Stok Keluar',
  inputStockIn: 'Input Stok Masuk',
  inputStockOut: 'Input Stok Keluar',

  // Batch
  batchUsageTitle: 'Pemakaian Batch',
  batchUsageDescription: 'Catat pemakaian bahan baku untuk produksi',
  addBatch: 'Tambah Batch',
  editBatch: 'Edit Batch',
  deleteBatch: 'Hapus Batch',

  // Reports
  stockReportsTitle: 'Laporan Stok',
  stockReportsDescription: 'Lihat laporan stok harian untuk bahan baku dan produk jadi',

  // Users
  usersTitle: 'Manajemen User',
  usersDescription: 'Kelola user dan peran mereka',
  addUser: 'Tambah User',
  editUser: 'Edit User',
  deleteUser: 'Hapus User',

  // Table Headers
  code: 'Kode',
  sku: 'SKU',
  name: 'Nama',
  materialName: 'Nama Material',
  productName: 'Nama Produk',
  currentStock: 'Stok Saat Ini',
  moq: 'MOQ',
  unit: 'Satuan',
  stockLevel: 'Level Stok',
  date: 'Tanggal',
  quantity: 'Jumlah',
  type: 'Tipe',
  notes: 'Catatan',
  createdBy: 'Dibuat Oleh',
  role: 'Peran',
  email: 'Email',

  // Messages
  deleteConfirmation: 'Apakah Anda yakin ingin menghapus',
  deleteWarning: 'Tindakan ini tidak dapat dibatalkan.',
  deleteSuccess: 'berhasil dihapus',
  deleteFailed: 'Gagal menghapus',
  saveSuccess: 'berhasil disimpan',
  saveFailed: 'Gagal menyimpan',
  loadFailed: 'Gagal memuat data. Silakan refresh halaman.',

  // Auth
  login: 'Masuk',
  logout: 'Keluar',
  username: 'Username',
  password: 'Password',

  // Roles
  admin: 'Admin',
  factory: 'Pabrik',
  office: 'Kantor',
}

export const t = (key: keyof typeof translations): string => {
  return translations[key] || key
}
