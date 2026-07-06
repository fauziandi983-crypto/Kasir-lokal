const { getDB } = require('./db');

async function fixConstraints() {
  const db = await getDB();
  try {
    console.log("Checking and fixing constraints...");
    
    // Barang: kode_barang unique per toko_id
    await db.exec('ALTER TABLE barang DROP CONSTRAINT IF EXISTS barang_kode_barang_key');
    await db.exec('ALTER TABLE barang DROP CONSTRAINT IF EXISTS barang_business_kode_unique');
    await db.exec('ALTER TABLE barang ADD CONSTRAINT barang_toko_kode_unique UNIQUE (toko_id, kode_barang)');
    console.log("Fixed barang unique constraint");
    
    // Pelanggan: nama_pelanggan unique per toko_id
    await db.exec('ALTER TABLE pelanggan DROP CONSTRAINT IF EXISTS pelanggan_nama_unique');
    await db.exec('ALTER TABLE pelanggan DROP CONSTRAINT IF EXISTS pelanggan_nama_pelanggan_key');
    await db.exec('ALTER TABLE pelanggan ADD CONSTRAINT pelanggan_toko_nama_unique UNIQUE (toko_id, nama_pelanggan)');
    console.log("Fixed pelanggan unique constraint");
    
    console.log("Constraints updated.");
  } catch(e) {
    console.error("Error:", e);
  }
}
fixConstraints();
