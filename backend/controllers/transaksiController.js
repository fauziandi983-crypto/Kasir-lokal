const { getDB } = require('../db');

exports.checkout = async (req, res) => {
  const { pelanggan_id, pelanggan_nama, uang_bayar, is_mode_pedagang, items } = req.body;
  const user_id = req.user.id; // Get user_id from token for security
  
  if (!items || items.length === 0) {
    return res.status(400).json({ message: 'Cart is empty' });
  }

  const db = await getDB();
  
  try {
    await db.run('BEGIN TRANSACTION');

    let final_pelanggan_id = pelanggan_id || null;
    if (pelanggan_nama && pelanggan_nama.trim() !== '') {
      const existingPelanggan = await db.get('SELECT id FROM pelanggan WHERE nama_pelanggan ILIKE ?', [pelanggan_nama.trim()]);
      if (existingPelanggan) {
        final_pelanggan_id = existingPelanggan.id;
      } else {
        const pResult = await db.run('INSERT INTO pelanggan (nama_pelanggan, tipe_pelanggan) VALUES (?, ?) RETURNING id', [pelanggan_nama.trim(), is_mode_pedagang ? 'pedagang' : 'biasa']);
        final_pelanggan_id = pResult.lastID;
      }
    }

    let total_belanja = 0;
    let total_diskon = 0;
    const nota_nomor = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const isModePedagangInt = is_mode_pedagang ? 1 : 0;

    // Create Transaksi Header
    const trxResult = await db.run(`
      INSERT INTO transaksi (nota_nomor, user_id, pelanggan_id, total_belanja, total_diskon, uang_bayar, uang_kembalian, is_mode_pedagang)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `, [nota_nomor, user_id || null, final_pelanggan_id, 0, 0, uang_bayar, 0, isModePedagangInt]);
    
    const transaksi_id = trxResult.lastID;

    for (const item of items) {
      const { barang_id, jumlah_beli } = item;
      let remaining_to_deduct = parseFloat(jumlah_beli);

      const barang = await db.get('SELECT * FROM barang WHERE id = ?', [barang_id]);
      if (!barang) throw new Error(`Barang ID ${barang_id} not found`);

      // Determine Price
      let harga_satuan_terpakai = parseFloat(barang.harga_jual_ecer);
      let isGrosir = false;

      if (is_mode_pedagang || remaining_to_deduct >= parseFloat(barang.min_beli_grosir)) {
        harga_satuan_terpakai = parseFloat(barang.harga_jual_grosir);
        isGrosir = true;
      }

      const itemTotal = remaining_to_deduct * harga_satuan_terpakai;
      const normalTotal = remaining_to_deduct * parseFloat(barang.harga_jual_ecer);
      const diskon_per_item = isGrosir ? normalTotal - itemTotal : 0;

      total_belanja += itemTotal;
      total_diskon += diskon_per_item;

      // FEFO Batch Logic (No FOR UPDATE needed in SQLite during transaction)
      const batches = await db.all(`
        SELECT * FROM barang_batch 
        WHERE barang_id = ? AND stok_batch > 0 AND COALESCE(tgl_expired, '9999-12-31') >= CURRENT_DATE
        ORDER BY COALESCE(tgl_expired, '9999-12-31') ASC
      `, [barang_id]);

      let batchIndex = 0;
      while (remaining_to_deduct > 0 && batchIndex < batches.length) {
        const batch = batches[batchIndex];
        const stockBatch = parseFloat(batch.stok_batch);
        
        let deduct_amount = 0;
        if (stockBatch >= remaining_to_deduct) {
          deduct_amount = remaining_to_deduct;
          remaining_to_deduct = 0;
        } else {
          deduct_amount = stockBatch;
          remaining_to_deduct -= stockBatch;
        }

        // Update batch stock
        await db.run(`
          UPDATE barang_batch SET stok_batch = stok_batch - ? WHERE id = ?
        `, [deduct_amount, batch.id]);

        // Insert Detail
        await db.run(`
          INSERT INTO transaksi_detail (transaksi_id, barang_id, batch_id, jumlah_beli, harga_satuan_terpakai, diskon_per_item)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [transaksi_id, barang_id, batch.id, deduct_amount, harga_satuan_terpakai, isGrosir ? (diskon_per_item * (deduct_amount / jumlah_beli)) : 0]);

        batchIndex++;
      }

      if (remaining_to_deduct > 0) {
        throw new Error(`Insufficient stock for Barang ID ${barang_id}. Missing ${remaining_to_deduct} units.`);
      }
    }

    const uang_kembalian = uang_bayar - total_belanja;
    if (uang_kembalian < 0) {
      throw new Error(`Uang bayar tidak cukup. Kurang ${Math.abs(uang_kembalian)}`);
    }

    // Update Transaksi Header Totals
    await db.run(`
      UPDATE transaksi SET total_belanja = ?, total_diskon = ?, uang_kembalian = ? WHERE id = ?
    `, [total_belanja, total_diskon, uang_kembalian, transaksi_id]);

    await db.run('COMMIT');
    res.json({ message: 'Checkout successful', transaksi_id, nota_nomor, total_belanja, uang_kembalian });
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Checkout Error:', error);
    res.status(400).json({ message: error.message || 'Checkout failed' });
  }
};

exports.getTransaksi = async (req, res) => {
  const { startDate, endDate } = req.query;
  const db = await getDB();
  
  try {
    let query = `
      SELECT t.*, p.nama_pelanggan, u.username as nama_kasir
      FROM transaksi t
      LEFT JOIN pelanggan p ON t.pelanggan_id = p.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    // RBAC: Kasir can only see their own transactions
    if (req.user.role === 'kasir') {
      query += " AND t.user_id = ?";
      params.push(req.user.id);
    }
    
    if (startDate && endDate) {
      query += " AND DATE(t.waktu_transaksi) >= DATE(?) AND DATE(t.waktu_transaksi) <= DATE(?)";
      params.push(startDate, endDate);
    }
    
    query += " ORDER BY t.waktu_transaksi DESC";
    
    const transactions = await db.all(query, params);
    res.json(transactions);
  } catch (error) {
    console.error('Get Transaksi Error:', error);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};
