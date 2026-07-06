const { getDB } = require('./db');

async function runMigration() {
  const db = await getDB();
  console.log("Starting multi-barcode migration...");

  try {
    // 1. Create barang_barcodes Table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS barang_barcodes (
        id SERIAL PRIMARY KEY,
        barang_id INTEGER REFERENCES barang(id) ON DELETE CASCADE,
        barcode VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(barang_id, barcode)
      )
    `);
    console.log("Created barang_barcodes table.");

    // 2. Insert existing kode_barang into barang_barcodes
    console.log("Migrating existing kode_barang to barang_barcodes...");
    const barangList = await db.all("SELECT id, kode_barang FROM barang");
    
    let migratedCount = 0;
    for (const b of barangList) {
      if (b.kode_barang) {
        // First check if exists because Postgres ON CONFLICT might need special syntax or just manual check
        const exists = await db.get(`SELECT id FROM barang_barcodes WHERE barang_id = ? AND barcode = ?`, [b.id, b.kode_barang]);
        if (!exists) {
          try {
            await db.run(`INSERT INTO barang_barcodes (barang_id, barcode) VALUES (?, ?)`, [b.id, b.kode_barang]);
            migratedCount++;
          } catch (e) {
            console.error(`Error migrating barcode for barang ${b.id}:`, e.message);
          }
        }
      }
    }
    
    console.log(`Successfully migrated ${migratedCount} barcodes.`);
    console.log("Migration completed successfully.");
    process.exit(0);

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
