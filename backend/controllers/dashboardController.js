const { getDB } = require('../db');

const getFilterInterval = (filter) => {
  switch(filter) {
    case 'mingguan': return "INTERVAL '7 days'";
    case 'bulanan': return "INTERVAL '30 days'";
    case '3bulan': return "INTERVAL '90 days'";
    case '6bulan': return "INTERVAL '180 days'";
    case '1tahun': return "INTERVAL '365 days'";
    default: return "INTERVAL '30 days'"; // default bulanan
  }
};

exports.getSummary = async (req, res) => {
  try {
    const db = await getDB();
    const filter = req.query.filter || 'bulanan';
    const intervalSql = getFilterInterval(filter);
    
    // 1. Pendapatan Hari Ini
    const today = new Date().toISOString().split('T')[0];
    const revTodayRow = await db.get(`
      SELECT SUM(total_belanja) as total 
      FROM transaksi 
      WHERE DATE(waktu_transaksi) = ?
    `, [today]);
    const pendapatan_hari_ini = parseFloat(revTodayRow?.total || 0);

    // 2. Pendapatan Periode & Transaksi Periode
    const revPeriodRow = await db.get(`
      SELECT SUM(total_belanja) as total, COUNT(id) as count 
      FROM transaksi 
      WHERE DATE(waktu_transaksi) >= CURRENT_DATE - ${intervalSql}
    `);
    const pendapatan_bulan_ini = parseFloat(revPeriodRow?.total || 0);
    const transaksi_bulan_ini = parseInt(revPeriodRow?.count || 0, 10);

    // 3. Keuntungan Bersih Periode
    const profitRow = await db.get(`
      SELECT SUM((td.harga_satuan_terpakai - COALESCE(bb.harga_beli_aktual, b.harga_beli)) * td.jumlah_beli - COALESCE(td.diskon_per_item, 0)) as keuntungan
      FROM transaksi_detail td
      JOIN transaksi t ON td.transaksi_id = t.id
      LEFT JOIN barang_batch bb ON td.batch_id = bb.id
      LEFT JOIN barang b ON td.barang_id = b.id
      WHERE DATE(t.waktu_transaksi) >= CURRENT_DATE - ${intervalSql}
    `);
    const keuntungan_bulan_ini = parseFloat(profitRow?.keuntungan || 0);

    // 4. Saldo Toko (Nilai Aset Stok Saat Ini)
    const saldoRow = await db.get(`
      SELECT SUM(bb.stok_batch * COALESCE(bb.harga_beli_aktual, b.harga_beli)) as total 
      FROM barang_batch bb
      JOIN barang b ON bb.barang_id = b.id
      WHERE bb.stok_batch > 0
    `);
    const saldo_toko = parseFloat(saldoRow?.total || 0);

    res.json({
      pendapatan_hari_ini,
      pendapatan_bulan_ini, // reusing field name for frontend compatibility
      transaksi_bulan_ini,  // reusing field name
      keuntungan_bulan_ini, // reusing field name
      saldo_toko,
      kerugian_bulan_ini: 0 // Optional: implement logic if needed
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching summary' });
  }
};

exports.getBestSellers = async (req, res) => {
  try {
    const db = await getDB();
    const filter = req.query.filter || 'bulanan';
    const intervalSql = getFilterInterval(filter);

    const rows = await db.all(`
      SELECT b.nama_barang, b.satuan_pecahan, SUM(td.jumlah_beli) as total_terjual 
      FROM transaksi_detail td
      JOIN transaksi t ON td.transaksi_id = t.id
      JOIN barang b ON td.barang_id = b.id
      WHERE DATE(t.waktu_transaksi) >= CURRENT_DATE - ${intervalSql}
      GROUP BY b.id
      ORDER BY total_terjual DESC
      LIMIT 5
    `);
    
    res.json(rows.map(r => ({ ...r, total_terjual: parseFloat(r.total_terjual) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching best sellers' });
  }
};

exports.getSalesChart = async (req, res) => {
  try {
    const db = await getDB();
    const filter = req.query.filter || 'mingguan';
    // For chart, if not mingguan, we might want to aggregate differently, but let's keep it simple and just show the last N days.
    // Wait, showing 365 bars in the UI will break the chart.
    // The user requested filter for the dashboard. If they select 1 tahun, a daily bar chart will be too dense.
    // Let's group by week or month if the filter is large, or just limit to the most recent if not grouping.
    // Let's modify chartData to adapt based on filter.
    let intervalSql = getFilterInterval(filter);
    let dateFormat = 'YYYY-MM-DD';
    let groupSql = `TO_CHAR(waktu_transaksi, 'YYYY-MM-DD')`;
    let numDays = 7;

    switch(filter) {
      case 'mingguan': numDays = 7; break;
      case 'bulanan': numDays = 30; break;
      case '3bulan': numDays = 90; break;
      case '6bulan': numDays = 180; break; // we might want to group by week here, but let's do daily for now, frontend uses flex so it might be small.
      case '1tahun': numDays = 365; break;
    }

    // If more than 30 days, we'll group by month to keep the chart readable
    if (numDays >= 90) {
      groupSql = `TO_CHAR(waktu_transaksi, 'YYYY-MM')`;
    }

    const rows = await db.all(`
      SELECT ${groupSql} as tanggal, SUM(total_belanja) as total 
      FROM transaksi 
      WHERE DATE(waktu_transaksi) >= CURRENT_DATE - ${intervalSql}
      GROUP BY ${groupSql}
      ORDER BY ${groupSql} ASC
    `);
    
    // Instead of filling missing days for all ranges (which is complex for months),
    // let's just return the aggregated rows and the frontend will render them.
    // However, if we don't fill, days with 0 sales will be skipped.
    const chartData = rows.map(r => ({
      tanggal: r.tanggal,
      total: parseFloat(r.total)
    }));

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
