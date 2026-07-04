const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Starting Hutang features migration...');

db.serialize(() => {
  db.run("ALTER TABLE transaksi ADD COLUMN status_pembayaran TEXT DEFAULT 'LUNAS'", (err) => {
    if (err && !err.message.includes('duplicate column name')) console.error('Error adding status_pembayaran:', err.message);
    else if (!err) console.log('Added column status_pembayaran.');
  });

  db.run("ALTER TABLE transaksi ADD COLUMN sisa_tagihan REAL DEFAULT 0", (err) => {
    if (err && !err.message.includes('duplicate column name')) console.error('Error adding sisa_tagihan:', err.message);
    else if (!err) console.log('Added column sisa_tagihan.');
  });

  db.run("ALTER TABLE transaksi ADD COLUMN tgl_jatuh_tempo TEXT", (err) => {
    if (err && !err.message.includes('duplicate column name')) console.error('Error adding tgl_jatuh_tempo:', err.message);
    else if (!err) console.log('Added column tgl_jatuh_tempo.');
  });

  db.run("ALTER TABLE transaksi ADD COLUMN catatan_hutang TEXT", (err) => {
    if (err && !err.message.includes('duplicate column name')) console.error('Error adding catatan_hutang:', err.message);
    else if (!err) console.log('Added column catatan_hutang.');
  });

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS pembayaran_hutang (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaksi_id INTEGER NOT NULL,
      jumlah_bayar REAL NOT NULL,
      tgl_bayar TEXT NOT NULL,
      kasir_id INTEGER,
      toko_id INTEGER,
      FOREIGN KEY (transaksi_id) REFERENCES transaksi (id),
      FOREIGN KEY (kasir_id) REFERENCES users (id),
      FOREIGN KEY (toko_id) REFERENCES users (id)
    )
  `;
  db.run(createTableQuery, (err) => {
    if (err) console.error('Error creating pembayaran_hutang table:', err.message);
    else console.log('Table pembayaran_hutang created or already exists.');
  });

  db.run("UPDATE transaksi SET status_pembayaran = 'LUNAS' WHERE status_pembayaran IS NULL", (err) => {
    if (err) console.error('Error updating existing records:', err.message);
    else console.log('Updated existing records to LUNAS.');
  });
});

db.close(() => {
  console.log('Hutang migration completed successfully.');
});
