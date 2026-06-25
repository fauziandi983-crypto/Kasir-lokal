const { getDB } = require('./db');

async function seed() {
  const db = await getDB();
  
  try {
    console.log('Seeding dummy data...');
    
    // Insert Barang 1
    const res1 = await db.run(`
      INSERT INTO barang (kode_barang, nama_barang, satuan_utama, satuan_pecahan, multiplier_konversi, harga_beli, harga_jual_ecer, harga_jual_grosir, min_beli_grosir, stok_awal_referensi)
      VALUES ('BRG-001', 'Kopi Kapal Api', 'Dus', 'Sachet', 120, 1000, 1500, 1300, 20, 1000)
    `);
    const id1 = res1.lastID;
    
    // Insert Batch for Barang 1
    await db.run(`
      INSERT INTO barang_batch (barang_id, no_batch, barcode_batch, stok_batch, tgl_expired)
      VALUES (?, 'BATCH-A1', '123456789', 500, '2026-12-31')
    `, [id1]);

    // Insert Barang 2
    const res2 = await db.run(`
      INSERT INTO barang (kode_barang, nama_barang, satuan_utama, satuan_pecahan, multiplier_konversi, harga_beli, harga_jual_ecer, harga_jual_grosir, min_beli_grosir, stok_awal_referensi)
      VALUES ('BRG-002', 'Beras Maknyus', 'Karung', 'Kg', 25, 10000, 13000, 11500, 10, 500)
    `);
    const id2 = res2.lastID;
    
    // Insert Batch for Barang 2
    await db.run(`
      INSERT INTO barang_batch (barang_id, no_batch, barcode_batch, stok_batch, tgl_expired)
      VALUES (?, 'BATCH-B1', '987654321', 250, '2027-06-30')
    `, [id2]);

    console.log('Seeding complete.');
  } catch (error) {
    console.error('Seeding error (perhaps already seeded?):', error.message);
  }
}

seed();
