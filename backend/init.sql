-- 1. Tabel Users (Autentikasi & RBAC)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'owner', 'kasir'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Pelanggan (CRM)
CREATE TABLE IF NOT EXISTS pelanggan (
    id SERIAL PRIMARY KEY,
    nama_pelanggan VARCHAR(100) NOT NULL,
    tipe_pelanggan VARCHAR(20) DEFAULT 'biasa', -- 'biasa', 'pedagang'
    no_telepon VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.5 Tabel Supplier
CREATE TABLE IF NOT EXISTS supplier (
    id SERIAL PRIMARY KEY,
    nama_supplier VARCHAR(150) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Barang (Master Produk)
CREATE TABLE IF NOT EXISTS barang (
    id SERIAL PRIMARY KEY,
    kode_barang VARCHAR(50) UNIQUE NOT NULL,
    nama_barang VARCHAR(150) NOT NULL,
    kategori VARCHAR(50) DEFAULT 'Umum',
    satuan_utama VARCHAR(30) NOT NULL,
    satuan_pecahan VARCHAR(30) NOT NULL,
    multiplier_konversi DECIMAL(12,2) NOT NULL,
    harga_beli DECIMAL(12,2) NOT NULL,
    harga_jual_ecer DECIMAL(12,2) NOT NULL,
    harga_jual_grosir DECIMAL(12,2) NOT NULL,
    min_beli_grosir DECIMAL(12,2) NOT NULL,
    stok_awal_referensi DECIMAL(12,2) NOT NULL,
    stok_minimum DECIMAL(12,2) DEFAULT 0,
    supplier_id INTEGER REFERENCES supplier(id) ON DELETE SET NULL
);

-- 4. Tabel Barang_Batch (Pelacakan FEFO)
CREATE TABLE IF NOT EXISTS barang_batch (
    id SERIAL PRIMARY KEY,
    barang_id INTEGER,
    no_batch VARCHAR(50) NOT NULL,
    barcode_batch VARCHAR(100) NULL,
    stok_batch DECIMAL(12,2) NOT NULL,
    tgl_expired DATE NOT NULL,
    tgl_masuk TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    supplier_id INTEGER REFERENCES supplier(id) ON DELETE SET NULL,
    harga_beli_aktual DECIMAL(12,2),
    FOREIGN KEY (barang_id) REFERENCES barang(id) ON DELETE CASCADE
);

-- 5. Tabel Transaksi (Header POS)
CREATE TABLE IF NOT EXISTS transaksi (
    id SERIAL PRIMARY KEY,
    nota_nomor VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER,
    pelanggan_id INTEGER NULL,
    total_belanja DECIMAL(12,2) NOT NULL,
    total_diskon DECIMAL(12,2) DEFAULT 0.00,
    uang_bayar DECIMAL(12,2) NOT NULL,
    uang_kembalian DECIMAL(12,2) NOT NULL,
    is_mode_pedagang BOOLEAN DEFAULT FALSE,
    waktu_transaksi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (pelanggan_id) REFERENCES pelanggan(id) ON DELETE SET NULL
);

-- 6. Tabel Transaksi_Detail (Item POS)
CREATE TABLE IF NOT EXISTS transaksi_detail (
    id SERIAL PRIMARY KEY,
    transaksi_id INTEGER,
    barang_id INTEGER,
    batch_id INTEGER,
    jumlah_beli DECIMAL(12,2) NOT NULL,
    harga_satuan_terpakai DECIMAL(12,2) NOT NULL,
    diskon_per_item DECIMAL(12,2) DEFAULT 0.00,
    FOREIGN KEY (transaksi_id) REFERENCES transaksi(id) ON DELETE CASCADE,
    FOREIGN KEY (barang_id) REFERENCES barang(id) ON DELETE SET NULL,
    FOREIGN KEY (batch_id) REFERENCES barang_batch(id) ON DELETE SET NULL
);

-- Insert Default Owner (password: admin123)
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$wuHPvOCTa3ZJOToheqS03O5PwTD6ipunWJ.8gZDXUWmIjeIyJBmHK', 'owner')
ON CONFLICT (username) DO NOTHING;

-- 7. Tabel Log Kerugian (Mencatat kerugian stok expired)
CREATE TABLE IF NOT EXISTS log_kerugian (
    id SERIAL PRIMARY KEY,
    tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    barang_id INTEGER,
    batch_id INTEGER,
    jumlah_stok_terbuang DECIMAL(12,2) NOT NULL,
    nilai_kerugian_rp DECIMAL(12,2) NOT NULL,
    keterangan TEXT,
    FOREIGN KEY (barang_id) REFERENCES barang(id) ON DELETE SET NULL,
    FOREIGN KEY (batch_id) REFERENCES barang_batch(id) ON DELETE SET NULL
);
