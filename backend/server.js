require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── SECURITY: Helmet – pasang HTTP security headers ──────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Dinonaktifkan agar Google OAuth iframe tetap bisa jalan
  contentSecurityPolicy: false,     // Frontend SPA diatur terpisah via Cloudflare/nginx
}));

// ─── SECURITY: CORS – hanya izinkan domain resmi ──────────────────────────────
const allowedOrigins = [
  'https://kasir.ukmonline.my.id',
  'http://localhost:5173',  // Dev lokal
  'http://localhost:3000',  // Dev lokal alternatif
];
app.use(cors({
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (misal dari Postman / server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' tidak diizinkan`));
  },
  credentials: true,
}));

// ─── SECURITY: Rate Limiter – perlindungan brute force ────────────────────────
// Limiter ketat khusus endpoint autentikasi
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,                   // Maks 10 percobaan per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.' },
  skipSuccessfulRequests: true, // Hanya hitung percobaan yang gagal
});

// Limiter ekstra ketat untuk forgot-password (cegah email bombing)
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 3,                    // Maks 3 permintaan per IP per jam
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan reset password. Coba lagi dalam 1 jam.' },
});

// Limiter umum untuk seluruh API (cegah DDoS ringan)
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 200,                 // Maks 200 request per IP per menit
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak request. Silakan tunggu sebentar.' },
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register-public', authLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);

// ─── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'POS System API is running.' });
});

// Import Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/barang', require('./routes/barang'));
app.use('/api/transaksi', require('./routes/transaksi')); 
app.use('/api/supplier', require('./routes/supplier'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/toko', require('./routes/toko'));
app.use('/api/backup', require('./routes/backup'));
// app.use('/api/pelanggan', require('./routes/pelanggan')); // To be implemented

// Start Server for standalone / PM2 / aaPanel deployment
async function startServer() {
  await initializeDatabase();

  // --- TEMPORARY FIX AUTO-RUN ---
  // Mengotomatiskan perbaikan database karena terminal aaPanel tidak bisa dibuka
  try {
    const { getDB } = require('./db');
    const db = await getDB();
    await db.run('UPDATE barang_batch SET harga_beli_aktual = 3000 WHERE harga_beli_aktual = 30000');
    
    // Auto-fix missing columns on STB Postgres
    await db.exec('ALTER TABLE toko ADD COLUMN IF NOT EXISTS logo TEXT');
    await db.exec('ALTER TABLE toko ADD COLUMN IF NOT EXISTS alamat TEXT');
    await db.exec('ALTER TABLE toko ADD COLUMN IF NOT EXISTS no_hp VARCHAR(50)');
    
    // Auto-fix Multi-Tenant Unique Constraints
    try { await db.exec('ALTER TABLE barang DROP CONSTRAINT IF EXISTS barang_kode_barang_key'); } catch(e){}
    try { await db.exec('ALTER TABLE barang DROP CONSTRAINT IF EXISTS barang_business_kode_unique'); } catch(e){}
    try { await db.exec('ALTER TABLE barang ADD CONSTRAINT barang_toko_kode_unique UNIQUE (toko_id, kode_barang)'); } catch(e){}
    
    try { await db.exec('ALTER TABLE pelanggan DROP CONSTRAINT IF EXISTS pelanggan_nama_unique'); } catch(e){}
    try { await db.exec('ALTER TABLE pelanggan DROP CONSTRAINT IF EXISTS pelanggan_nama_pelanggan_key'); } catch(e){}
    try { await db.exec('ALTER TABLE pelanggan ADD CONSTRAINT pelanggan_toko_nama_unique UNIQUE (toko_id, nama_pelanggan)'); } catch(e){}

    // Auto-fix Transaksi Unique Constraint (The exact error encountered)
    try { await db.exec('ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS transaksi_nota_nomor_key'); } catch(e){}
    try { await db.exec('ALTER TABLE transaksi ADD CONSTRAINT transaksi_toko_nota_unique UNIQUE (toko_id, nota_nomor)'); } catch(e){}

    console.log('Auto-fixed DB schema, data, and constraints on startup');
  } catch (e) {
    console.error('Error auto-fixing DB:', e);
  }
  // ------------------------------

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
startServer();

module.exports = app;
