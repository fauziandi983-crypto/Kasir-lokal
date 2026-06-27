const { getDB } = require('./db');

async function testProfit() {
  const db = await getDB();
  try {
    const res = await db.all(`
      SELECT 
        td.id,
        td.harga_satuan_terpakai,
        bb.harga_beli_aktual,
        b.harga_beli,
        td.jumlah_beli,
        td.diskon_per_item,
        (td.harga_satuan_terpakai - COALESCE(bb.harga_beli_aktual, b.harga_beli)) * td.jumlah_beli - COALESCE(td.diskon_per_item, 0) as row_profit
      FROM transaksi_detail td
      JOIN transaksi t ON td.transaksi_id = t.id
      LEFT JOIN barang_batch bb ON td.batch_id = bb.id
      LEFT JOIN barang b ON td.barang_id = b.id
    `);
    console.log('Details:', res);

    const sumRes = await db.get(`
      SELECT SUM((td.harga_satuan_terpakai - COALESCE(bb.harga_beli_aktual, b.harga_beli)) * td.jumlah_beli - COALESCE(td.diskon_per_item, 0)) as keuntungan
      FROM transaksi_detail td
      JOIN transaksi t ON td.transaksi_id = t.id
      LEFT JOIN barang_batch bb ON td.batch_id = bb.id
      LEFT JOIN barang b ON td.barang_id = b.id
    `);
    console.log('Sum:', sumRes);
  } catch (err) {
    console.error(err);
  }
}

testProfit();
