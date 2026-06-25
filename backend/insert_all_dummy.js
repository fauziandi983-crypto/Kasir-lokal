const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function insertDummy() {
  const db = await open({
    filename: path.join(__dirname, 'pos_database.sqlite'),
    driver: sqlite3.Database
  });

  try {
    // 1. Dapatkan Supplier
    const suppliers = await db.all('SELECT * FROM supplier LIMIT 3');
    if (suppliers.length < 3) {
      console.log("Suppliers not found. Make sure migration ran.");
      return;
    }
    const supId1 = suppliers[0].id;
    const supId2 = suppliers[1].id;
    const supId3 = suppliers[2].id;

    // 2. Set supplier_id untuk semua barang lama agar muncul di kolom "Supplier"
    await db.run('UPDATE barang SET supplier_id = ? WHERE supplier_id IS NULL', [supId1]);
    
    // 3. Masukkan riwayat harga (batch dummy) untuk SEMUA barang yang ada
    const barangs = await db.all('SELECT * FROM barang');
    
    for (const barang of barangs) {
      // Hapus dummy lama untuk barang ini agar tidak double
      await db.run('DELETE FROM barang_batch WHERE barang_id = ? AND no_batch LIKE ?', [barang.id, '%DUMMY%']);

      // Base price = harga_beli barang tersebut
      const basePrice = barang.harga_beli || 50000;

      const queries = [
        { supId: supId1, harga: basePrice, tgl: '2023-01-10' },
        { supId: supId2, harga: basePrice + 1500, tgl: '2023-02-15' },
        { supId: supId1, harga: basePrice - 500, tgl: '2023-03-20' },
        { supId: supId3, harga: basePrice - 2000, tgl: '2023-04-05' }, // Termurah
        { supId: supId2, harga: basePrice + 1000, tgl: '2023-05-12' },
      ];

      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        const no_batch = `${barang.kode_barang}-${q.tgl.replace(/-/g, '')}-DUMMY${i}`;
        await db.run(`
          INSERT INTO barang_batch (barang_id, no_batch, barcode_batch, stok_batch, tgl_masuk, tgl_expired, supplier_id, harga_beli_aktual)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [barang.id, no_batch, null, 10, q.tgl, '2025-01-01', q.supId, q.harga]);
      }
    }

    console.log('Dummy riwayat harga berhasil ditambahkan ke SEMUA barang!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.close();
  }
}

insertDummy();
