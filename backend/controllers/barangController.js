const { getDB } = require('../db');
const { logActivity } = require('../utils/logger');

exports.getAllBarang = async (req, res) => {
  try {
    const db = await getDB();
    let condition = 'WHERE 1=1';
    let params = [];

    if (req.user.role === 'superadmin') {
      condition = 'WHERE b.business_id = ?';
      params.push(req.user.business_id);
    } else if (req.user.role === 'toko' || req.user.role === 'kasir') {
      condition = 'WHERE b.toko_id = ?';
      params.push(req.user.toko_id);
    }

    const rows = await db.all(`
      SELECT b.*, COALESCE(SUM(bb.stok_batch), 0) AS total_stok, s.nama_supplier 
      FROM barang b 
      LEFT JOIN barang_batch bb ON b.id = bb.barang_id AND bb.stok_batch > 0 AND bb.tgl_expired >= CURRENT_DATE
      LEFT JOIN supplier s ON b.supplier_id = s.id
      ${condition}
      GROUP BY b.id, s.nama_supplier
      ORDER BY b.nama_barang ASC
    `, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching barang' });
  }
};

exports.previewExpired = async (req, res) => {
  try {
    const db = await getDB();
    let condition = 'WHERE bb.tgl_expired < CURRENT_DATE AND bb.stok_batch > 0';
    let params = [];
    if (req.user.role === 'superadmin') {
      condition += ' AND b.business_id = ?';
      params.push(req.user.business_id);
    } else if (req.user.role === 'toko' || req.user.role === 'kasir') {
      condition += ' AND b.toko_id = ?';
      params.push(req.user.toko_id);
    }

    const expiredBatches = await db.all(`
      SELECT bb.id, bb.stok_batch, bb.tgl_expired, b.nama_barang, COALESCE(bb.harga_beli_aktual, b.harga_beli) as harga_modal
      FROM barang_batch bb
      JOIN barang b ON bb.barang_id = b.id
      ${condition}
    `, params);
    
    let totalItems = 0;
    let totalKerugian = 0;
    
    expiredBatches.forEach(b => {
      totalItems += b.stok_batch;
      totalKerugian += (b.stok_batch * b.harga_modal);
    });
    
    res.json({ totalItems, totalKerugian, batches: expiredBatches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error memuat preview kerugian' });
  }
};

exports.buangExpired = async (req, res) => {
  try {
    const db = await getDB();
    
    let condition = 'WHERE bb.tgl_expired < CURRENT_DATE AND bb.stok_batch > 0';
    let params = [];
    if (req.user.role === 'superadmin') {
      condition += ' AND b.business_id = ?';
      params.push(req.user.business_id);
    } else if (req.user.role === 'toko' || req.user.role === 'kasir') {
      condition += ' AND b.toko_id = ?';
      params.push(req.user.toko_id);
    }

    // Get all expired before zeroing
    const expiredBatches = await db.all(`
      SELECT bb.id as batch_id, bb.barang_id, bb.stok_batch, COALESCE(bb.harga_beli_aktual, b.harga_beli) as harga_modal, b.nama_barang
      FROM barang_batch bb
      JOIN barang b ON bb.barang_id = b.id
      ${condition}
    `, params);
    
    if (expiredBatches.length === 0) {
      return res.json({ message: 'Tidak ada stok kedaluwarsa yang perlu dibuang.' });
    }

    await db.run('BEGIN TRANSACTION');
    
    let totalTerbuang = 0;
    
    for (const batch of expiredBatches) {
      const kerugian = batch.stok_batch * batch.harga_modal;
      await db.run(`
        INSERT INTO log_kerugian (barang_id, batch_id, jumlah_stok_terbuang, nilai_kerugian_rp, keterangan, business_id, toko_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [batch.barang_id, batch.batch_id, batch.stok_batch, kerugian, `Stok expired: ${batch.nama_barang}`, req.user.business_id, req.user.toko_id]);
      
      totalTerbuang += batch.stok_batch;
    }
    
    await db.run("UPDATE barang_batch SET stok_batch = 0 WHERE tgl_expired < CURRENT_DATE AND stok_batch > 0");
    await db.run('COMMIT');
    
    await logActivity(req, 'BUANG_EXPIRED', `Membuang ${totalTerbuang} stok kedaluwarsa dengan total kerugian Rp${totalKerugian || 0}`);
    
    res.json({ message: `Berhasil mengeluarkan ${totalTerbuang} item barang kedaluwarsa dan mencatat kerugian.` });
  } catch (error) {
    console.error(error);
    const db = await getDB();
    await db.run('ROLLBACK');
    res.status(500).json({ message: 'Error membuang stok kedaluwarsa' });
  }
};

exports.getLaporanKerugian = async (req, res) => {
  try {
    const db = await getDB();
    let condition = 'WHERE 1=1';
    let params = [];
    if (req.user.role === 'superadmin') {
      condition = 'WHERE l.business_id = ?';
      params.push(req.user.business_id);
    } else if (req.user.role === 'toko' || req.user.role === 'kasir') {
      condition = 'WHERE l.toko_id = ?';
      params.push(req.user.toko_id);
    }

    const rows = await db.all(`
      SELECT l.*, b.nama_barang 
      FROM log_kerugian l
      LEFT JOIN barang b ON l.barang_id = b.id
      ${condition}
      ORDER BY l.tanggal DESC
    `, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching laporan kerugian' });
  }
};

exports.getMonitoringStok = async (req, res) => {
  try {
    const db = await getDB();
    let condition = 'WHERE bb.stok_batch > 0';
    let params = [];
    if (req.user.role === 'superadmin') {
      condition += ' AND b.business_id = ?';
      params.push(req.user.business_id);
    } else if (req.user.role === 'toko' || req.user.role === 'kasir') {
      condition += ' AND b.toko_id = ?';
      params.push(req.user.toko_id);
    }

    const rows = await db.all(`
      SELECT 
        bb.id AS batch_id, bb.no_batch, bb.stok_batch, bb.tgl_expired, bb.tgl_masuk,
        b.kode_barang, b.nama_barang, b.satuan_pecahan
      FROM barang_batch bb
      JOIN barang b ON bb.barang_id = b.id
      ${condition}
      ORDER BY bb.tgl_expired ASC
    `, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching monitoring stok' });
  }
};

exports.createBarang = async (req, res) => {
  let db;
  try {
    const {
      kode_barang, nama_barang, kategori, satuan_utama, satuan_pecahan,
      multiplier_konversi, harga_beli, harga_jual_ecer,
      harga_jual_grosir, min_beli_grosir, stok_awal_referensi,
      stok_minimum, nama_supplier
    } = req.body;

    db = await getDB();
    await db.run('BEGIN TRANSACTION');

    let req_toko_id = req.body.toko_id;
    if (req.user.role === 'toko' || req.user.role === 'kasir') {
      req_toko_id = req.user.toko_id;
    }

    let supplier_id = null;
    if (nama_supplier && nama_supplier.trim()) {
      const existing = await db.get('SELECT id FROM supplier WHERE nama_supplier ILIKE ? AND business_id = ?', [nama_supplier.trim(), req.user.business_id]);
      if (existing) {
        supplier_id = existing.id;
      } else {
        const supResult = await db.run('INSERT INTO supplier (nama_supplier, business_id, toko_id) VALUES (?, ?, ?) RETURNING id', [nama_supplier.trim(), req.user.business_id, req_toko_id]);
        supplier_id = supResult.lastID;
      }
    }

    const query = `
      INSERT INTO barang (
        kode_barang, nama_barang, kategori, satuan_utama, satuan_pecahan,
        multiplier_konversi, harga_beli, harga_jual_ecer,
        harga_jual_grosir, min_beli_grosir, stok_awal_referensi,
        stok_minimum, supplier_id, business_id, toko_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `;
    const result = await db.run(query, [
      kode_barang, nama_barang, kategori || 'Umum', satuan_utama, satuan_pecahan,
      multiplier_konversi, harga_beli, harga_jual_ecer,
      harga_jual_grosir, min_beli_grosir, stok_awal_referensi,
      stok_minimum || 0, supplier_id, req.user.business_id, req_toko_id
    ]);

    await db.run('COMMIT');
    await logActivity(req, 'CREATE_BARANG', `Menambahkan barang baru: ${nama_barang} (${kode_barang})`);
    res.status(201).json({ id: result.lastID, message: 'Barang created' });
  } catch (error) {
    if (db) await db.run('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Error creating barang' });
  }
};

exports.updateHarga = async (req, res) => {
  try {
    const { id } = req.params;
    const { harga_beli, harga_jual_ecer, harga_jual_grosir } = req.body;

    const db = await getDB();
    
    // Authorization check
    if (req.user.role !== 'owner') {
      const b = await db.get('SELECT business_id, toko_id FROM barang WHERE id = ?', [id]);
      if (!b) return res.status(404).json({ message: 'Barang tidak ditemukan' });
      if (req.user.role === 'superadmin' && b.business_id !== req.user.business_id) return res.status(403).json({ message: 'Akses ditolak' });
      if ((req.user.role === 'toko' || req.user.role === 'kasir') && b.toko_id !== req.user.toko_id) return res.status(403).json({ message: 'Akses ditolak' });
    }

    await db.run(
      'UPDATE barang SET harga_beli = ?, harga_jual_ecer = ?, harga_jual_grosir = ? WHERE id = ?',
      [harga_beli, harga_jual_ecer, harga_jual_grosir, id]
    );

    await logActivity(req, 'UPDATE_HARGA', `Mengubah harga untuk barang ID: ${id}`);
    res.json({ message: 'Harga berhasil diupdate' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating harga' });
  }
};

exports.getBatches = async (req, res) => {
  try {
    const { barang_id } = req.params;
    const db = await getDB();
    const rows = await db.all('SELECT * FROM barang_batch WHERE barang_id = ? ORDER BY tgl_expired ASC', [barang_id]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching batches' });
  }
};

exports.createBatch = async (req, res) => {
  try {
    const { barang_id } = req.params;
    const { barcode_batch, stok_batch, tgl_masuk, tgl_expired, supplier_id, harga_beli_aktual } = req.body;

    const db = await getDB();
    
    const barang = await db.get('SELECT kode_barang FROM barang WHERE id = ?', [barang_id]);
    if (!barang) return res.status(404).json({ message: 'Barang not found' });
    
    let dateStr = '';
    if (tgl_masuk) {
      dateStr = tgl_masuk.replace(/-/g, '');
    } else {
      const today = new Date();
      dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    }

    const no_batch = `${barang.kode_barang}-${dateStr}-${Math.floor(Math.random() * 1000)}`;

    const query = `
      INSERT INTO barang_batch (barang_id, no_batch, barcode_batch, stok_batch, tgl_masuk, tgl_expired, supplier_id, harga_beli_aktual)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `;
    const result = await db.run(query, [
      barang_id, no_batch, barcode_batch, stok_batch, 
      tgl_masuk || new Date().toISOString().split('T')[0], 
      tgl_expired, supplier_id || null, harga_beli_aktual || null
    ]);

    await logActivity(req, 'ADD_STOK', `Menambahkan stok batch sejumlah ${stok_batch} untuk barang ID: ${barang_id}`);
    res.status(201).json({ id: result.lastID, message: 'Batch created' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating batch' });
  }
};

exports.getRiwayatHarga = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    const rows = await db.all(`
      SELECT bb.id, bb.tgl_masuk, bb.harga_beli_aktual, s.nama_supplier 
      FROM barang_batch bb
      LEFT JOIN supplier s ON bb.supplier_id = s.id
      WHERE bb.barang_id = ? AND bb.harga_beli_aktual IS NOT NULL
      ORDER BY bb.tgl_masuk DESC
    `, [id]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching riwayat harga' });
  }
};

exports.deleteBarang = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();

    // Authorization check
    if (req.user.role !== 'owner') {
      const b = await db.get('SELECT business_id, toko_id FROM barang WHERE id = ?', [id]);
      if (!b) return res.status(404).json({ message: 'Barang tidak ditemukan' });
      if (req.user.role === 'superadmin' && b.business_id !== req.user.business_id) return res.status(403).json({ message: 'Akses ditolak' });
      if ((req.user.role === 'toko' || req.user.role === 'kasir') && b.toko_id !== req.user.toko_id) return res.status(403).json({ message: 'Akses ditolak' });
    }

    await db.run('DELETE FROM barang WHERE id = ?', [id]);
    await logActivity(req, 'DELETE_BARANG', `Menghapus barang ID: ${id}`);
    res.json({ message: 'Barang berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting barang:', error);
    res.status(500).json({ message: 'Error deleting barang' });
  }
};
