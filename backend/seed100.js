const { getDB } = require('./db');

const categories = ['Snack', 'Minuman', 'Sembako', 'Pembersih', 'Bumbu'];
const units = [
  { u: 'Dus', p: 'Pcs', m: 24 },
  { u: 'Karung', p: 'Kg', m: 50 },
  { u: 'Lusin', p: 'Buah', m: 12 },
  { u: 'Pack', p: 'Sachet', m: 10 }
];

async function seed() {
  const db = await getDB();
  console.log('Generating 100 dummy products...');
  
  try {
    await db.run('BEGIN TRANSACTION');

    for (let i = 1; i <= 100; i++) {
      const cat = categories[i % categories.length];
      const unit = units[i % units.length];
      
      const kode_barang = `BRG-${1000 + i}`;
      const nama_barang = `${cat} Produk Dummy ${i}`;
      const harga_beli = Math.floor(Math.random() * 50 + 10) * 100; // 1000 - 6000
      const harga_jual_ecer = harga_beli + Math.floor(Math.random() * 10 + 5) * 100;
      const harga_jual_grosir = harga_beli + Math.floor(Math.random() * 5 + 2) * 100;
      const min_beli_grosir = Math.floor(Math.random() * 5) + 5; // 5 to 10
      const stok_awal = Math.floor(Math.random() * 500) + 100;
      
      const res = await db.run(`
        INSERT INTO barang (kode_barang, nama_barang, satuan_utama, satuan_pecahan, multiplier_konversi, harga_beli, harga_jual_ecer, harga_jual_grosir, min_beli_grosir, stok_awal_referensi)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [kode_barang, nama_barang, unit.u, unit.p, unit.m, harga_beli, harga_jual_ecer, harga_jual_grosir, min_beli_grosir, stok_awal]);
      
      const barang_id = res.lastID;
      
      // Insert 2 batches for each
      const now = new Date();
      now.setDate(now.getDate() + Math.floor(Math.random() * 30) + 10); // expires in 10-40 days
      const d1 = now.toISOString().split('T')[0];
      
      now.setDate(now.getDate() + Math.floor(Math.random() * 60) + 30); // expires in 40-100 days
      const d2 = now.toISOString().split('T')[0];

      await db.run(`
        INSERT INTO barang_batch (barang_id, no_batch, barcode_batch, stok_batch, tgl_expired)
        VALUES (?, ?, ?, ?, ?)
      `, [barang_id, `BCH1-${kode_barang}`, `BC1-${i}`, Math.floor(stok_awal * 0.4), d1]);

      await db.run(`
        INSERT INTO barang_batch (barang_id, no_batch, barcode_batch, stok_batch, tgl_expired)
        VALUES (?, ?, ?, ?, ?)
      `, [barang_id, `BCH2-${kode_barang}`, `BC2-${i}`, Math.floor(stok_awal * 0.6), d2]);
    }

    await db.run('COMMIT');
    console.log('100 dummy products and batches seeded successfully!');
  } catch (err) {
    await db.run('ROLLBACK');
    console.error('Error seeding data:', err.message);
  }
}

seed();
