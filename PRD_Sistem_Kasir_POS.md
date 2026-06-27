# SYSTEM INSTRUCTION & PRODUCT REQUIREMENTS DOCUMENT (PRD)
## PROYEK: SISTEM POS (POINT OF SALE) & INVENTARIS MULTI-BATCH DENGAN ALGORITMA FEFO

Dokumen ini dirancang sebagai panduan konteks utama (System Prompt / Context Context) untuk AI Coding Assistant. Terapkan seluruh arsitektur, aturan logika, kontrol konkurensi, dan struktur data di bawah ini tanpa pengecualian saat menulis kode.

---

## 1. RINGKASAN SISTEM (SYSTEM OVERVIEW)
Sistem ini adalah aplikasi Kasir (POS) dan Manajemen Inventaris Retail/Grosir yang mendukung konversi satuan dinamis, pelacakan stok berbasis batch kedaluwarsa dengan algoritma FEFO, multi-level user pricing, manajemen hubungan pelanggan (CRM), dan sistem pengingat otomatis. Aplikasi harus tangguh terhadap kendala sinkronisasi data dari banyak kasir yang mengakses stok secara bersamaan.

---

## 2. ARSITEKTUR INVENTARIS & MANAJEMEN SATUAN (DYNAMIC MULTIPLIER)
* **Dynamic Unit Multiplier:** Sistem tidak boleh mengunci hierarki satuan secara kaku (seperti Dus > Pack > Pcs). Admin toko harus menentukan secara dinamis komponen satuan untuk setiap barang (Contoh: Karung > Kg > Gram, atau Dus > Botol > Liter, atau Ikat > Ikat Kecil).
* **Struktur Pecahan/Desimal:** Kolom database untuk `stok`, `jumlah_pembelian`, dan `multiplier_konversi` WAJIB menggunakan tipe data desimal (`Decimal` atau `Float`) untuk mendukung komoditas eceran (Contoh pembelian: `0.5 Kg` atau `1.5 Liter`).
* **Penyimpanan Backend Tunggal:** Di tingkat database, semua kalkulasi stok, penambahan, pengurangan, dan konversi wajib dihitung dan disimpan berdasarkan **Satuan Terkecil** (satuan pecahan paling dasar) untuk menghindari pembulatan bias dan selisih stok.

---

## 3. LOGIKA MANAJEMEN STOK & SISTEM BATCH (ALGORITMA FEFO)
* **Multi-Batch Tracking:** Setiap barang masuk (restock) wajib dicatat dalam baris data terpisah berdasarkan nomor/id **Batch** yang mengikat Tanggal Kedaluwarsa (*Expired Date*).
* **Algoritma FEFO (First Expired, First Out):** Saat terjadi penjualan di kasir, sistem secara otomatis memotong stok dari batch yang memiliki tanggal kedaluwarsa paling dekat. Jika kuantitas pada batch terdekat habis dan pembelian belum terpenuhi, sistem harus otomatis memotong sisa kuantitas dari batch kedaluwarsa terdekat berikutnya secara berurutan.
* **Future-Proofing Barcode Per Batch:** Desain tabel batch harus menyediakan kolom opsional untuk menyimpan `barcode_batch`. Ini dipersiapkan agar di masa mendatang sistem dapat melakukan pemotongan via pemindaian barcode spesifik batch di rak.
* **Modul Penyesuaian Stok (Stock Adjustment):** Menyediakan fitur *Write-off* / *Opname* khusus di luar modul penjualan untuk mencatat pengurangan stok akibat barang rusak, bocor, dimakan hama, atau kadaluwarsa. Transaksi ini tidak boleh menambah omset penjualan melainkan dicatat sebagai beban kerugian toko.

---

## 4. LOGIKA PENENTUAN HARGA & DISKON (MIX & MATCH KUANTITAS)
Sistem mengelola 3 tingkatan harga jual: **Harga Eceran (Reguler)**, **Harga Grosir**, dan **Harga Grosir Pedagang**.
* **Akumulasi Kuantitas Otomatis:** Di keranjang belanja kasir, jika item yang sama dimasukkan beberapa kali (meskipun menggunakan satuan berbeda, misal: 1 Dus berisi 20 Pcs ditambah 4 Pcs eceran), sistem harus mengonversinya ke satuan terkecil (total 24 Pcs). Jika total kuantitas menyentuh atau melewati batasan "Minimum Beli Grosir" yang ditentukan di Master Barang, maka **seluruh item tersebut otomatis berubah menjadi Harga Grosir**.
* **Pencatatan Diskon Otomatis:** Setiap transaksi yang memicu harga grosir wajib menghitung selisih total harga nominal (`(Harga Eceran - Harga Grosir) * Kuantitas`). Selisih nilai ini wajib disimpan dalam kolom khusus `diskon_diberikan` di tabel transaksi untuk laporan analisis.

---

## 5. MODE KASIR (POS INTERFACE) & MANAGEMENT PELANGGAN (CRM)
* **Merchant Override (Mode Pedagang):** Antarmuka kasir wajib menyediakan tombol saklar (*Toggle Switch*) untuk mengaktifkan "Mode Pedagang".
* **Aturan Mode Pedagang:** Jika mode ini aktif, seluruh barang yang dimasukkan ke dalam keranjang belanja otomatis dikenakan **Harga Grosir**, tanpa perlu memenuhi batas minimum kuantitas pembelian barang.
* **Validasi Nama Pembeli:** Jika Mode Pedagang aktif, kasir WAJIB menginput atau memilih **Nama Pelanggan** yang terdaftar. Jika pembeli biasa (mode reguler), pengisian nama bersifat opsional (dapat berupa *Anonim*).
* **Data Riwayat Belanja (CRM):** Sistem wajib merekam setiap transaksi yang diikat dengan Nama Pelanggan. Data ini akan diolah untuk menghitung akumulasi total pembelian pelanggan dan analisis tren produk yang paling sering dibeli oleh pelanggan tersebut.
* **Detail Pembayaran Kasir:** Setiap transaksi wajib mencatat: `Waktu Pembelian (Timestamp)`, `Total Belanja`, `Jumlah Uang Bayar`, dan `Sisa Uang Kembalian`.

---

## 6. SISTEM NOTIFIKASI & PENGINGAT (ALERTS SYSTEM)
Sistem harus mengecek dan memicu pengingat secara otomatis di halaman dashboard utama:
* **Low Stock Warning:** Memicu peringatan jika total sisa stok barang (gabungan seluruh batch dalam satuan terkecil) menyentuh atau kurang dari **1/4 (25%)** dari jumlah stok awal ketika barang pertama kali didaftarkan/di-restock.
* **Expiry Warning:** Memicu peringatan kritis tepat **10 hari sebelum** tanggal kedaluwarsa suatu batch barang menyentuh hari-H.

---

## 7. MANAJEMEN PENGGUNA & HAK AKSES (MULTI-TENANT SAAS)
Sistem ini menggunakan arsitektur Multi-Tenant SaaS 4-tingkat:
* **Role Owner (Root):** Memiliki akses mutlak ke seluruh database dan dapat memonitor seluruh bisnis klien dan cabang. (Sistem Root)
* **Role Super Admin (Pemilik Bisnis):** Mendaftar secara mandiri. Membawahi banyak cabang (Toko). Dapat membuat dan memonitor seluruh toko, namun tidak dapat melakukan transaksi kasir secara langsung.
* **Role Toko (Manajer Cabang):** Dibuat oleh Super Admin. Mengelola master barang cabangnya, logo, profil toko, dan menambah akun kasir di cabangnya.
* **Role Kasir:** Hanya diizinkan mengakses halaman transaksi kasir (POS) dan melihat histori struk cabangnya sendiri. Tidak dapat melihat data cabang lain.

---

## 8. KONTROL KONKURENSI & KEAMANAN DATA (ANTI-MINUS STOCK)
Untuk mencegah kebocoran data stok jika terdapat lebih dari 1 kasir aktif (Kasir 1 dan Kasir 2) yang menekan tombol bayar pada milidetik yang sama untuk sisa barang yang terbatas:
* **Database Transactions (ACID):** Seluruh proses checkout kasir wajib dijalankan di dalam blok transaksi database tunggal (jika gagal di tengah jalan wajib `ROLLBACK`, jika sukses wajib `COMMIT`).
* **Row-Level Locking:** Mengimplementasikan perintah penguncian baris data (Contoh: `SELECT ... FOR UPDATE` atau mekanisme locking ORM) saat membaca sisa stok batch di kasir sebelum pemotongan dilakukan. Transaksi kasir lain wajib mengantre hingga proses tulis kasir pertama selesai.
* **Database Constraint:** Kolom kuantitas stok wajib dikonfigurasi dengan aturan nilai minimum `0` (`UNSIGNED`) di tingkat database agar mesin database menolak perintah secara mutlak jika ada bug logika yang mencoba membuat stok bernilai negatif.

---

## 9. BLUEPRINT SKEMA DATABASE (ENTITY RELATIONSHIP BLUEPRINT)

Gunakan rancangan relasi tabel berikut sebagai acuan pembuatan migrasi database atau model:

```sql
-- 1. Tabel Business (Klien Utama / Super Admin)
CREATE TABLE business (
    id SERIAL PRIMARY KEY,
    nama_klien VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1b. Tabel Toko (Cabang)
CREATE TABLE toko (
    id SERIAL PRIMARY KEY,
    business_id INT,
    nama_toko VARCHAR(100) NOT NULL,
    logo TEXT NULL,
    alamat TEXT NULL,
    no_hp VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES business(id)
);

-- 1c. Tabel Users (Autentikasi & RBAC Multi-Tenant)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('owner', 'superadmin', 'toko', 'kasir')) NOT NULL,
    business_id INT NULL,
    toko_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES business(id),
    FOREIGN KEY (toko_id) REFERENCES toko(id)
);

-- 2. Tabel Pelanggan (CRM)
CREATE TABLE pelanggan (
    id SERIAL PRIMARY KEY,
    nama_pelanggan VARCHAR(100) NOT NULL,
    tipe_pelanggan VARCHAR(20) CHECK (tipe_pelanggan IN ('biasa', 'pedagang')) DEFAULT 'biasa',
    no_telepon VARCHAR(20) NULL,
    business_id INT NULL,
    toko_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES business(id),
    FOREIGN KEY (toko_id) REFERENCES toko(id)
);

-- 3. Tabel Barang (Master Produk)
CREATE TABLE barang (
    id INT PRIMARY KEY AUTO_INCREMENT,
    kode_barang VARCHAR(50) UNIQUE NOT NULL,
    nama_barang VARCHAR(150) NOT NULL,
    satuan_utama VARCHAR(30) NOT NULL, -- Contoh: Dus, Karung, Liter
    satuan_pecahan VARCHAR(30) NOT NULL, -- Contoh: Pcs, Kg, Gram
    multiplier_konversi DECIMAL(10,2) NOT NULL, -- Hubungan Utama ke Pecahan
    harga_beli DECIMAL(12,2) NOT NULL,
    harga_jual_ecer DECIMAL(12,2) NOT NULL,
    harga_jual_grosir DECIMAL(12,2) NOT NULL,
    min_beli_grosir DECIMAL(10,2) NOT NULL, -- Dalam Satuan Terkecil
    stok_awal_referensi DECIMAL(10,2) NOT NULL -- Untuk perhitungan batas 1/4 stok
);

-- 4. Tabel Barang_Batch (Pelacakan FEFO)
CREATE TABLE barang_batch (
    id INT PRIMARY KEY AUTO_INCREMENT,
    barang_id INT,
    no_batch VARCHAR(50) NOT NULL,
    barcode_batch VARCHAR(100) NULL,
    stok_batch DECIMAL(10,2) NOT NULL, -- Disimpan dalam Satuan Terkecil
    tgl_expired DATE NOT NULL,
    tgl_masuk TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barang_id) REFERENCES barang(id)
);

-- 5. Tabel Transaksi (Header POS)
CREATE TABLE transaksi (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nota_nomor VARCHAR(50) UNIQUE NOT NULL,
    user_id INT, -- Kasir yang melayani
    pelanggan_id INT NULL, -- Hubungan ke CRM
    total_belanja DECIMAL(12,2) NOT NULL,
    total_diskon DECIMAL(12,2) DEFAULT 0.00, -- Rekam akumulasi diskon grosir
    uang_bayar DECIMAL(12,2) NOT NULL,
    uang_kembalian DECIMAL(12,2) NOT NULL,
    is_mode_pedagang BOOLEAN DEFAULT FALSE,
    waktu_transaksi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (pelanggan_id) REFERENCES pelanggan(id)
);

-- 6. Tabel Transaksi_Detail (Item POS)
CREATE TABLE transaksi_detail (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transaksi_id INT,
    barang_id INT,
    batch_id INT, -- Mencatat batch mana yang terpotong oleh FEFO
    jumlah_beli DECIMAL(10,2) NOT NULL, -- Konversi ke Satuan Terkecil
    harga_satuan_terpakai DECIMAL(12,2) NOT NULL, -- Harga final setelah logika grosir/ecer
    diskon_per_item DECIMAL(12,2) DEFAULT 0.00,
    FOREIGN KEY (transaksi_id) REFERENCES transaksi(id),
    FOREIGN KEY (barang_id) REFERENCES barang(id),
    FOREIGN KEY (batch_id) REFERENCES barang_batch(id)
);

-- 7. Tabel Stock_Adjustment (Non-Penjualan / Kerugian)
CREATE TABLE stock_adjustment (
    id INT PRIMARY KEY AUTO_INCREMENT,
    barang_id INT,
    batch_id INT,
    user_id INT, -- Owner yang melakukan adjustment
    jumlah_penyesuaian DECIMAL(10,2) NOT NULL, -- Nilai negatif untuk pengurangan
    alasan_penyesuaian ENUM('rusak', 'hilang', 'kadaluwarsa', 'opname_selisih') NOT NULL,
    keterangan TEXT NULL,
    waktu_adjustment TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (barang_id) REFERENCES barang(id),
    FOREIGN KEY (batch_id) REFERENCES barang_batch(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 10. FITUR PEMINDAI BARCODE (BARCODE SCANNER VIA KAMERA)
Sistem mendukung pemindaian barcode menggunakan kamera perangkat (laptop webcam atau kamera HP/tablet):
* **Library:** Menggunakan `html5-qrcode` untuk mendeteksi barcode 1D (EAN-13, Code 128, dll.) dan QR Code 2D.
* **Lokasi Fitur Scanner:**
  * **Menu Transaksi Kasir:** Tombol "Scan Barcode" untuk memindai kode barang dan otomatis menambahkannya ke keranjang.
  * **Menu Master Barang (Tambah Baru):** Tombol kamera di kolom "Kode Barang" untuk mengisi kode barang dari barcode fisik.
  * **Menu Restock Batch:** Tombol kamera di kolom "Barcode Batch" untuk mengisi kode barcode batch secara otomatis.
* **Persyaratan Teknis:** Fitur kamera memerlukan koneksi HTTPS agar browser mengizinkan akses kamera (menggunakan `@vitejs/plugin-basic-ssl` untuk development).

---

## 11. AKSES VIA HP/TABLET (MOBILE ACCESS)
* **HTTPS Dev Server:** Frontend Vite dikonfigurasi dengan sertifikat SSL self-signed agar bisa diakses secara aman dari perangkat lain di jaringan lokal.
* **Metode Koneksi:** HP/Tablet terhubung via Mobile Hotspot laptop atau jaringan Wi-Fi yang sama.
* **Alamat Akses:** `https://<IP-laptop>:5173` (contoh: `https://192.168.137.1:5173`).

---

## 12. SISTEM AUTENTIKASI & MANAJEMEN USER
* **Login:** Pengguna wajib login dengan username dan password sebelum bisa mengakses aplikasi.
* **Token JWT:** Setelah login berhasil, server mengeluarkan token JWT (berlaku 1 hari) yang disimpan di localStorage browser.
* **Manajemen User (Owner Only):** Owner dapat menambah user baru (dengan role owner/kasir), melihat daftar user, dan menghapus user.
* **Akun Default:** `admin` / `admin123` (role: owner).
* **Password Hashing:** Semua password di-hash menggunakan bcrypt sebelum disimpan ke database.

---

## 13. UI/UX & RESPONSIVE DESIGN (MOBILE-FIRST)
Sistem dirancang agar dapat diakses dari berbagai jenis perangkat dengan mengadaptasi tata letak secara dinamis:
* **Tampilan Desktop (Laptop/PC):** Menggunakan tata letak dua kolom (grid). Menu navigasi utama diletakkan di **Sidebar Kiri** yang bersifat statis. Area konten utama berada di sebelah kanan dengan spasi dan tabel yang lebar.
* **Tampilan Mobile (HP/Tablet):** Sidebar disembunyikan. Navigasi dialihkan ke **Bottom Navigation Bar** (seperti aplikasi native Android/iOS). Tabel-tabel dirancang lebih kompak (padding lebih kecil, scroll dinamis) agar informasi muat di layar sempit tanpa harus sering melakukan scroll horizontal. Komponen lain seperti form input juga diubah menggunakan ukuran dan letak yang ramah sentuhan (touch-friendly).

---

## 14. PANDUAN DEPLOYMENT (CLOUD)
Sistem ini siap di-deploy secara publik (*online*) agar multi-cabang atau multi-kasir bisa terhubung melalui internet tanpa server lokal:
* **Backend:** Direkomendasikan menggunakan layanan cloud container (seperti Render.com atau Heroku). Backend harus dikonfigurasi untuk terhubung dengan **Database PostgreSQL eksternal** (seperti Supabase atau Neon) karena SQLite tidak cocok untuk hosting *ephemeral* (layanan gratis yang me-reset disk).
* **Frontend:** Dikonfigurasi untuk di-host menggunakan layanan CDN (seperti Vercel atau Netlify). Perutean API dari frontend ke backend di server produksi ditangani melalui instruksi *rewrite* yang disematkan dalam konfigurasi spesifik hosting (contoh: file `vercel.json` menggunakan array `rewrites` ke arah *API base URL* backend).
* Panduan teknis langkah demi langkah mengenai deployment tersedia secara rinci di file independen `panduan_deploy_cloud.md`.
