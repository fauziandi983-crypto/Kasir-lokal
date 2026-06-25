const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function migrate() {
  const db = await open({
    filename: path.join(__dirname, 'pos_database.sqlite'),
    driver: sqlite3.Database
  });

  try {
    console.log('Starting migration for Supplier, Minimum Stok, and Riwayat Harga...');
    
    // 1. Create Supplier Table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS supplier (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_supplier TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Supplier table checked/created.');

    // 2. Alter Barang Table (add stok_minimum, supplier_id)
    try {
      await db.exec(`ALTER TABLE barang ADD COLUMN stok_minimum REAL DEFAULT 0`);
      console.log('Added stok_minimum to barang.');
    } catch (e) {
      if (!e.message.includes('duplicate column name')) console.log('Column stok_minimum already exists.');
      else throw e;
    }

    try {
      await db.exec(`ALTER TABLE barang ADD COLUMN supplier_id INTEGER REFERENCES supplier(id)`);
      console.log('Added supplier_id to barang.');
    } catch (e) {
      if (!e.message.includes('duplicate column name')) console.log('Column supplier_id already exists in barang.');
      else throw e;
    }

    // 3. Alter Barang_Batch Table (add supplier_id, harga_beli_aktual)
    try {
      await db.exec(`ALTER TABLE barang_batch ADD COLUMN supplier_id INTEGER REFERENCES supplier(id)`);
      console.log('Added supplier_id to barang_batch.');
    } catch (e) {
      if (!e.message.includes('duplicate column name')) console.log('Column supplier_id already exists in barang_batch.');
      else throw e;
    }

    try {
      await db.exec(`ALTER TABLE barang_batch ADD COLUMN harga_beli_aktual REAL`);
      console.log('Added harga_beli_aktual to barang_batch.');
      
      // Update existing batches to have harga_beli_aktual from barang table
      await db.exec(`
        UPDATE barang_batch 
        SET harga_beli_aktual = (SELECT harga_beli FROM barang WHERE barang.id = barang_batch.barang_id)
        WHERE harga_beli_aktual IS NULL
      `);
      console.log('Migrated existing batch prices.');
    } catch (e) {
      if (!e.message.includes('duplicate column name')) console.log('Column harga_beli_aktual already exists in barang_batch.');
      else throw e;
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await db.close();
  }
}

migrate();
