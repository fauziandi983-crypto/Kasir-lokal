const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'pos_database.sqlite');
const db = new sqlite3.Database(dbPath);

const query = `
  SELECT b.id, b.kode_barang, b.nama_barang, b.satuan_pecahan, COALESCE(b.stok_minimum, 0) as stok_minimum,
         IFNULL((SELECT SUM(stok_batch) FROM barang_batch WHERE barang_id = b.id AND stok_batch > 0 AND tgl_expired >= date('now')), 0) AS total_stok
  FROM barang b
`;

db.all(query, [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  
  const needsRestock = rows.filter(item => item.total_stok === 0 || item.total_stok <= item.stok_minimum);
  
  console.log("NEEDS RESTOCK:");
  console.log(JSON.stringify(needsRestock, null, 2));
});
