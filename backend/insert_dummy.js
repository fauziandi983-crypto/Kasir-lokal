const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function insertDummy() {
  const db = await open({
    filename: path.join(__dirname, 'pos_database.sqlite'),
    driver: sqlite3.Database
  });

  try {
    console.log('Menyiapkan data dummy supplier dan batch...');

    // 1. Insert Suppliers
    await db.run('INSERT INTO supplier (nama_supplier) VALUES (?) ON CONFLICT (nama_supplier) DO NOTHING', ['PT Makmur Jaya']);
    await db.run('INSERT INTO supplier (nama_supplier) VALUES (?) ON CONFLICT (nama_supplier) DO NOTHING', ['CV Sumber Berkah']);
    await db.run('INSERT INTO supplier (nama_supplier) VALUES (?) ON CONFLICT (nama_supplier) DO NOTHING', ['Distributor Sembako Maju']);
    
    const suppliers = await db.all('SELECT * FROM supplier');
    const supId1 = suppliers.find(s => s.nama_supplier === 'PT Makmur Jaya').id;
    const supId2 = suppliers.find(s => s.nama_supplier === 'CV Sumber Berkah').id;
    const supId3 = suppliers.find(s => s.nama_supplier === 'Distributor Sembako Maju').id;

    console.log('Supplier berhasil ditambahkan/dicek.');

    // 2. Cek atau Buat Barang Dummy
    let barang = await db.get('SELECT * FROM barang LIMIT 1');
    if (!barang) {
      console.log('Tidak ada barang. Membuat barang dummy...');
      const res = await db.run(`
        INSERT INTO barang (
          kode_barang, nama_barang, kategori, satuan_utama, satuan_pecahan,
          multiplier_konversi, harga_beli, harga_jual_ecer, harga_jual_grosir,
          min_beli_grosir, stok_awal_referensi, stok_minimum, supplier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['DUMMY-001', 'Beras Super 5Kg', 'Sembako', 'Karung', 'Kg', 5, 50000, 55000, 52000, 5, 0, 10, supId1]);
      barang = { id: res.lastID, kode_barang: 'DUMMY-001' };
    }

    console.log(`Menggunakan barang ID: ${barang.id} (${barang.kode_barang})`);

    // 3. Insert Dummy Batches for Riwayat Harga
    const queries = [
      { supId: supId1, harga: 50000, tgl: '2023-01-10' },
      { supId: supId2, harga: 51000, tgl: '2023-02-15' },
      { supId: supId1, harga: 49500, tgl: '2023-03-20' },
      { supId: supId3, harga: 48000, tgl: '2023-04-05' }, // Termurah
      { supId: supId2, harga: 52000, tgl: '2023-05-12' },
    ];

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      const no_batch = `${barang.kode_barang}-${q.tgl.replace(/-/g, '')}-DUMMY${i}`;
      await db.run(`
        INSERT INTO barang_batch (barang_id, no_batch, barcode_batch, stok_batch, tgl_masuk, tgl_expired, supplier_id, harga_beli_aktual)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [barang.id, no_batch, null, 10, q.tgl, '2025-01-01', q.supId, q.harga]);
    }

    console.log('Dummy batches dengan berbagai supplier dan harga berhasil dimasukkan!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await db.close();
  }
}

insertDummy();
