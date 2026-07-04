const { getDB } = require('./db.js');

async function migrateHutang() {
  console.log('Starting Postgres Hutang features migration...');
  try {
    const db = await getDB();
    
    // Add columns to transaksi if they don't exist
    const alterQueries = [
      "ALTER TABLE transaksi ADD COLUMN status_pembayaran VARCHAR(20) DEFAULT 'LUNAS'",
      "ALTER TABLE transaksi ADD COLUMN sisa_tagihan NUMERIC(15, 2) DEFAULT 0",
      "ALTER TABLE transaksi ADD COLUMN tgl_jatuh_tempo TIMESTAMP",
      "ALTER TABLE transaksi ADD COLUMN catatan_hutang TEXT"
    ];

    for (let query of alterQueries) {
      try {
        await db.exec(query);
        console.log(`Successfully ran: ${query}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`Column already exists, skipping: ${query}`);
        } else {
          console.error(`Error running ${query}:`, err.message);
        }
      }
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS pembayaran_hutang (
        id SERIAL PRIMARY KEY,
        transaksi_id INTEGER NOT NULL REFERENCES transaksi(id) ON DELETE CASCADE,
        jumlah_bayar NUMERIC(15, 2) NOT NULL,
        tgl_bayar TIMESTAMP NOT NULL,
        kasir_id INTEGER REFERENCES users(id),
        toko_id INTEGER REFERENCES users(id)
      );
    `;
    
    try {
      await db.exec(createTableQuery);
      console.log('Table pembayaran_hutang created or verified.');
    } catch (err) {
      console.error('Error creating pembayaran_hutang table:', err.message);
    }

    try {
      await db.exec("UPDATE transaksi SET status_pembayaran = 'LUNAS' WHERE status_pembayaran IS NULL");
      console.log('Updated existing records to LUNAS.');
    } catch (err) {
      console.error('Error updating existing records:', err.message);
    }

    console.log('Hutang PostgreSQL migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrateHutang();
