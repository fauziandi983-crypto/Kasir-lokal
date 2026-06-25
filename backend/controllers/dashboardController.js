const { getDB } = require('../db');

exports.getSummary = async (req, res) => {
  try {
    const db = await getDB();
    
    // 1. Pendapatan Hari Ini
    const today = new Date().toISOString().split('T')[0];
    const revTodayRow = await db.get(`
      SELECT SUM(total_belanja) as total 
      FROM transaksi 
      WHERE date(waktu_transaksi) = ?
    `, [today]);
    const pendapatan_hari_ini = revTodayRow?.total || 0;

    // 2. Pendapatan Bulan Ini & Transaksi Bulan Ini
    const revMonthRow = await db.get(`
      SELECT SUM(total_belanja) as total, COUNT(id) as count 
      FROM transaksi 
      WHERE TO_CHAR(waktu_transaksi, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    `);
    const pendapatan_bulan_ini = revMonthRow?.total || 0;
    const transaksi_bulan_ini = revMonthRow?.count || 0;

    // 3. Keuntungan Bersih Bulan Ini
    const profitRow = await db.get(`
      SELECT SUM((td.harga_satuan_terpakai - COALESCE(bb.harga_beli_aktual, b.harga_beli)) * td.jumlah_beli - td.diskon_per_item) as keuntungan
      FROM transaksi_detail td
      JOIN transaksi t ON td.transaksi_id = t.id
      LEFT JOIN barang_batch bb ON td.batch_id = bb.id
      LEFT JOIN barang b ON td.barang_id = b.id
      WHERE TO_CHAR(t.waktu_transaksi, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    `);
    const keuntungan_bulan_ini = profitRow?.keuntungan || 0;

    // 4. Saldo Toko (Nilai Aset Stok Saat Ini)
    const saldoRow = await db.get(`
      SELECT SUM(bb.stok_batch * COALESCE(bb.harga_beli_aktual, b.harga_beli)) as total 
      FROM barang_batch bb
      JOIN barang b ON bb.barang_id = b.id
      WHERE bb.stok_batch > 0
    `);
    const saldo_toko = saldoRow?.total || 0;

    res.json({
      pendapatan_hari_ini,
      pendapatan_bulan_ini,
      transaksi_bulan_ini,
      keuntungan_bulan_ini,
      saldo_toko
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching summary' });
  }
};

exports.getBestSellers = async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all(`
      SELECT b.nama_barang, b.satuan_pecahan, SUM(td.jumlah_beli) as total_terjual 
      FROM transaksi_detail td
      JOIN barang b ON td.barang_id = b.id
      GROUP BY b.id
      ORDER BY total_terjual DESC
      LIMIT 5
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching best sellers' });
  }
};

exports.getSalesChart = async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all(`
      SELECT DATE(waktu_transaksi) as tanggal, SUM(total_belanja) as total 
      FROM transaksi 
      WHERE DATE(waktu_transaksi) >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY DATE(waktu_transaksi)
      ORDER BY DATE(waktu_transaksi) ASC
    `);
    
    // Fill missing days
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = rows.find(r => r.tanggal === dateStr);
      chartData.push({
        tanggal: dateStr,
        total: existing ? existing.total : 0
      });
    }

    res.json(chartData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching sales chart' });
  }
};

exports.getLowStockRecommendations = async (req, res) => {
  try {
    const db = await getDB();
    
    // Find items with total_stok <= stok_minimum OR total_stok == 0
    const lowStockItems = await db.all(`
      SELECT b.id, b.kode_barang, b.nama_barang, b.satuan_pecahan, COALESCE(b.stok_minimum, 0) as stok_minimum,
             COALESCE((SELECT SUM(stok_batch) FROM barang_batch WHERE barang_id = b.id AND stok_batch > 0 AND tgl_expired >= CURRENT_DATE), 0) AS total_stok
      FROM barang b
    `);

    const needsRestock = lowStockItems.filter(item => item.total_stok === 0 || item.total_stok <= item.stok_minimum);

    // For each item, find lowest historical price and its supplier
    const recommendations = await Promise.all(needsRestock.map(async (item) => {
      const cheapest = await db.get(`
        SELECT s.nama_supplier, bb.harga_beli_aktual, bb.tgl_masuk
        FROM barang_batch bb
        LEFT JOIN supplier s ON bb.supplier_id = s.id
        WHERE bb.barang_id = ? AND bb.harga_beli_aktual IS NOT NULL
        ORDER BY bb.harga_beli_aktual ASC, bb.tgl_masuk DESC
        LIMIT 1
      `, [item.id]);

      return {
        ...item,
        rek_supplier: cheapest?.nama_supplier || 'Tidak Ada Data',
        harga_termurah: cheapest?.harga_beli_aktual || 0
      };
    }));

    res.json(recommendations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching low stock recommendations' });
  }
};

exports.getExpiringItems = async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all(`
      SELECT b.nama_barang, bb.no_batch, bb.tgl_expired, bb.stok_batch, b.satuan_pecahan
      FROM barang_batch bb
      JOIN barang b ON bb.barang_id = b.id
      WHERE bb.stok_batch > 0 
        AND bb.tgl_expired <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY bb.tgl_expired ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching expiring items' });
  }
};
