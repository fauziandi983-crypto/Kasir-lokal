const { getDB } = require('../db');
const { parse } = require('json2csv');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Logika Export (Download)
exports.exportBarang = async (req, res) => {
  try {
    const db = await getDB();
    const query = req.user.role === 'superadmin' 
      ? `SELECT * FROM barang WHERE business_id = $1`
      : `SELECT * FROM barang WHERE toko_id = $1`;
    const params = req.user.role === 'superadmin' ? [req.user.business_id] : [req.user.toko_id];
    
    const data = await db.all(query, params);
    
    if (data.length === 0) return res.status(404).send('Tidak ada data barang');
    
    const csvStr = parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('data_barang.csv');
    res.send(csvStr);
  } catch (error) {
    console.error('Export Barang Error:', error);
    res.status(500).json({ message: 'Gagal export data' });
  }
};

exports.exportTransaksi = async (req, res) => {
  try {
    const db = await getDB();
    let query = `
      SELECT t.*, p.nama_pelanggan 
      FROM transaksi t
      LEFT JOIN pelanggan p ON t.pelanggan_id = p.id
    `;
    const params = [];
    if (req.user.role === 'superadmin') {
      query += ` WHERE t.business_id = $1`;
      params.push(req.user.business_id);
    } else {
      query += ` WHERE t.toko_id = $1`;
      params.push(req.user.toko_id);
    }
    
    const data = await db.all(query, params);
    
    if (data.length === 0) return res.status(404).send('Tidak ada data transaksi');
    
    const csvStr = parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('riwayat_transaksi.csv');
    res.send(csvStr);
  } catch (error) {
    console.error('Export Transaksi Error:', error);
    res.status(500).json({ message: 'Gagal export data' });
  }
};

exports.exportDetail = async (req, res) => {
  try {
    const db = await getDB();
    let query = `
      SELECT td.* 
      FROM transaksi_detail td
      JOIN transaksi t ON td.transaksi_id = t.id
    `;
    const params = [];
    if (req.user.role === 'superadmin') {
      query += ` WHERE t.business_id = $1`;
      params.push(req.user.business_id);
    } else {
      query += ` WHERE t.toko_id = $1`;
      params.push(req.user.toko_id);
    }
    
    const data = await db.all(query, params);
    
    if (data.length === 0) return res.status(404).send('Tidak ada data detail transaksi');
    
    const csvStr = parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('detail_transaksi.csv');
    res.send(csvStr);
  } catch (error) {
    console.error('Export Detail Error:', error);
    res.status(500).json({ message: 'Gagal export data' });
  }
};

exports.exportBatch = async (req, res) => {
  try {
    const db = await getDB();
    let query = `
      SELECT bb.* 
      FROM barang_batch bb
      JOIN barang b ON bb.barang_id = b.id
    `;
    const params = [];
    if (req.user.role === 'superadmin') {
      query += ` WHERE b.business_id = $1`;
      params.push(req.user.business_id);
    } else {
      query += ` WHERE b.toko_id = $1`;
      params.push(req.user.toko_id);
    }
    
    const data = await db.all(query, params);
    
    if (data.length === 0) return res.status(404).send('Tidak ada data batch barang');
    
    const csvStr = parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('data_stok_batch.csv');
    res.send(csvStr);
  } catch (error) {
    console.error('Export Batch Error:', error);
    res.status(500).json({ message: 'Gagal export data' });
  }
};

// Helper for parsing buffer to CSV
const parseCSVBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString());
    stream.pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

// Logika Import (Restore ACID)
exports.importFull = async (req, res) => {
  if (!req.files || !req.files.file_barang || !req.files.file_batch || !req.files.file_transaksi || !req.files.file_detail) {
    return res.status(400).json({ message: 'Harap upload keempat file CSV sekaligus (Barang, Batch, Transaksi, Detail)' });
  }

  const db = await getDB();
  try {
    // 1. Konversi Memory
    const barangList = await parseCSVBuffer(req.files.file_barang[0].buffer);
    const batchList = await parseCSVBuffer(req.files.file_batch[0].buffer);
    const transaksiList = await parseCSVBuffer(req.files.file_transaksi[0].buffer);
    const detailList = await parseCSVBuffer(req.files.file_detail[0].buffer);

    // ID Mapping (Tenant-Safe)
    const barangIdMap = {}; // old_id -> new_id
    const batchIdMap = {}; // old_id -> new_id
    const transaksiIdMap = {}; // old_id -> new_id

    // 2. ACID BEGIN
    await db.exec('BEGIN');

    // 3. Langkah A (Master Barang)
    for (const item of barangList) {
      if (!item.id || !item.kode_barang) continue;
      
      const req_toko_id = req.user.role === 'superadmin' ? null : req.user.toko_id;
      
      const existing = await db.get(`SELECT id FROM barang WHERE kode_barang = $1 AND toko_id = $2`, [item.kode_barang, req_toko_id]);
      let newId;

      if (existing) {
        await db.run(`
          UPDATE barang SET 
            nama_barang = $1, kategori = $2, satuan_utama = $3, satuan_pecahan = $4,
            multiplier_konversi = $5, harga_beli = $6, harga_jual_ecer = $7, harga_jual_grosir = $8,
            min_beli_grosir = $9, stok_awal_referensi = $10, stok_minimum = $11
          WHERE id = $12
        `, [
          item.nama_barang, item.kategori || 'Umum', item.satuan_utama || 'Pcs', item.satuan_pecahan || 'Pcs',
          parseFloat(item.multiplier_konversi) || 1, parseFloat(item.harga_beli) || 0,
          parseFloat(item.harga_jual_ecer) || 0, parseFloat(item.harga_jual_grosir) || 0,
          parseFloat(item.min_beli_grosir) || 0, parseFloat(item.stok_awal_referensi) || 0,
          parseFloat(item.stok_minimum) || 0, existing.id
        ]);
        newId = existing.id;
      } else {
        const result = await db.run(`
          INSERT INTO barang (
            kode_barang, nama_barang, kategori, satuan_utama, satuan_pecahan,
            multiplier_konversi, harga_beli, harga_jual_ecer, harga_jual_grosir,
            min_beli_grosir, stok_awal_referensi, stok_minimum, business_id, toko_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id
        `, [
          item.kode_barang, item.nama_barang, item.kategori || 'Umum', 
          item.satuan_utama || 'Pcs', item.satuan_pecahan || 'Pcs', 
          parseFloat(item.multiplier_konversi) || 1, parseFloat(item.harga_beli) || 0, 
          parseFloat(item.harga_jual_ecer) || 0, parseFloat(item.harga_jual_grosir) || 0,
          parseFloat(item.min_beli_grosir) || 0, parseFloat(item.stok_awal_referensi) || 0,
          parseFloat(item.stok_minimum) || 0, req.user.business_id, req_toko_id
        ]);
        newId = result.lastID;
      }

      if (newId) barangIdMap[item.id] = newId;
    }
    
    // Langkah A.5 (Stok Batch)
    for (const item of batchList) {
      if (!item.id || !item.barang_id) continue;
      
      const mappedBarangId = barangIdMap[item.barang_id];
      if (!mappedBarangId) continue; // Skip if barang not found
      
      // We will check by no_batch and barang_id to prevent duplicate batch on same item
      const existing = await db.get(`SELECT id FROM barang_batch WHERE no_batch = $1 AND barang_id = $2`, [item.no_batch, mappedBarangId]);
      let newId;

      if (existing) {
        await db.run(`
          UPDATE barang_batch SET
            barcode_batch = $1, stok_batch = $2, tgl_expired = $3, tgl_masuk = $4
          WHERE id = $5
        `, [
          item.barcode_batch, parseFloat(item.stok_batch) || 0, item.tgl_expired, item.tgl_masuk, existing.id
        ]);
        newId = existing.id;
      } else {
        const result = await db.run(`
          INSERT INTO barang_batch (
            barang_id, no_batch, barcode_batch, stok_batch, tgl_expired, tgl_masuk
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          mappedBarangId, item.no_batch, item.barcode_batch, parseFloat(item.stok_batch) || 0, item.tgl_expired, item.tgl_masuk
        ]);
        newId = result.lastID;
      }

      if (newId) batchIdMap[item.id] = newId;
    }

    // 4. Langkah B (Induk Transaksi)
    for (const item of transaksiList) {
      if (!item.id || !item.nota_nomor) continue;
      
      let p_id = null;
      if (item.nama_pelanggan && item.nama_pelanggan.trim() !== '') {
        const pExisting = await db.get(`SELECT id FROM pelanggan WHERE nama_pelanggan = $1 AND toko_id = $2`, [item.nama_pelanggan.trim(), req.user.toko_id]);
        if (pExisting) {
          p_id = pExisting.id;
        } else {
          const pResult = await db.run(`
            INSERT INTO pelanggan (nama_pelanggan, business_id, toko_id) 
            VALUES ($1, $2, $3) 
            RETURNING id
          `, [item.nama_pelanggan.trim(), req.user.business_id, req.user.toko_id]);
          p_id = pResult.lastID;
        }
      }
      
      const tExisting = await db.get(`SELECT id FROM transaksi WHERE nota_nomor = $1 AND toko_id = $2`, [item.nota_nomor, req.user.toko_id]);
      let newId;

      if (tExisting) {
        await db.run(`
          UPDATE transaksi SET
            user_id = $1, pelanggan_id = $2, total_belanja = $3, total_diskon = $4,
            uang_bayar = $5, uang_kembalian = $6, is_mode_pedagang = $7, waktu_transaksi = $8,
            status_pembayaran = $9, sisa_tagihan = $10
          WHERE id = $11
        `, [
          item.user_id ? parseInt(item.user_id) : null, p_id, 
          parseFloat(item.total_belanja) || 0, parseFloat(item.total_diskon) || 0, 
          parseFloat(item.uang_bayar) || 0, parseFloat(item.uang_kembalian) || 0, 
          item.is_mode_pedagang === '1' || item.is_mode_pedagang === 'true' || item.is_mode_pedagang === true ? 1 : 0, 
          item.waktu_transaksi, item.status_pembayaran || 'LUNAS', parseFloat(item.sisa_tagihan) || 0,
          tExisting.id
        ]);
        newId = tExisting.id;
      } else {
        const result = await db.run(`
          INSERT INTO transaksi (
            nota_nomor, user_id, pelanggan_id, total_belanja, total_diskon,
            uang_bayar, uang_kembalian, is_mode_pedagang, waktu_transaksi, 
            status_pembayaran, sisa_tagihan, business_id, toko_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `, [
          item.nota_nomor, item.user_id ? parseInt(item.user_id) : null, p_id, 
          parseFloat(item.total_belanja) || 0, parseFloat(item.total_diskon) || 0, 
          parseFloat(item.uang_bayar) || 0, parseFloat(item.uang_kembalian) || 0, 
          item.is_mode_pedagang === '1' || item.is_mode_pedagang === 'true' || item.is_mode_pedagang === true ? 1 : 0, 
          item.waktu_transaksi, item.status_pembayaran || 'LUNAS', parseFloat(item.sisa_tagihan) || 0,
          req.user.business_id, req.user.toko_id
        ]);
        newId = result.lastID;
      }

      if (newId) {
        transaksiIdMap[item.id] = newId;
        // Hapus detail transaksi lama jika kita melakukan update transaksi (hindari duplikasi)
        await db.run(`DELETE FROM transaksi_detail WHERE transaksi_id = $1`, [newId]);
      }
    }
    
    // 5. Langkah C (Anak Transaksi)
    for (const item of detailList) {
      if (!item.id || !item.transaksi_id) continue;
      
      const mappedTransaksiId = transaksiIdMap[item.transaksi_id];
      const mappedBarangId = item.barang_id && item.barang_id !== 'null' ? barangIdMap[item.barang_id] : null;
      const mappedBatchId = item.batch_id && item.batch_id !== 'null' ? batchIdMap[item.batch_id] : null;
      
      if (!mappedTransaksiId) continue;
      
      await db.run(`
        INSERT INTO transaksi_detail (
          transaksi_id, barang_id, batch_id, jumlah_beli, 
          harga_satuan_terpakai, diskon_per_item
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        mappedTransaksiId, mappedBarangId, mappedBatchId,
        parseFloat(item.jumlah_beli) || 0, 
        parseFloat(item.harga_satuan_terpakai) || 0, 
        parseFloat(item.diskon_per_item) || 0
      ]);
    }
    


    // 6. COMMIT
    await db.exec('COMMIT');
    res.json({ message: 'Restore berhasil! Semua data CSV telah dimasukkan ke database.' });
    
  } catch (error) {
    // VULN-03 FIX: Jangan kirim error.message/stack ke client
    console.error('Import Full Error:', error);
    await db.exec('ROLLBACK');
    res.status(500).json({ message: 'Gagal melakukan restore data. Periksa format file CSV Anda.' });
  }
};
