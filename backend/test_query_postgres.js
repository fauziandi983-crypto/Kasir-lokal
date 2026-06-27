require('./db').getDB().then(async db => {
  try {
    const q1 = await db.all("SELECT b.*, COALESCE(SUM(bb.stok_batch), 0) AS total_stok, s.nama_supplier FROM barang b LEFT JOIN barang_batch bb ON b.id = bb.barang_id AND bb.stok_batch > 0 AND bb.tgl_expired >= CURRENT_DATE LEFT JOIN supplier s ON b.supplier_id = s.id GROUP BY b.id");
    console.log('Query 1 success');
  } catch(e) {
    console.log('Error 1:', e.message);
  }
  try {
    const q2 = await db.all("SELECT b.*, COALESCE(SUM(bb.stok_batch), 0) AS total_stok, s.nama_supplier FROM barang b LEFT JOIN barang_batch bb ON b.id = bb.barang_id AND bb.stok_batch > 0 AND bb.tgl_expired >= CURRENT_DATE LEFT JOIN supplier s ON b.supplier_id = s.id GROUP BY b.id, s.nama_supplier");
    console.log('Query 2 success');
  } catch(e) {
    console.log('Error 2:', e.message);
  }
}).catch(console.error);
