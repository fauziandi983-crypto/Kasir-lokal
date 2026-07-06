const { getDB } = require('./db');
const bcrypt = require('bcryptjs');

async function runMigration() {
  const db = await getDB();
  console.log("Starting multi-tenant migration...");

  try {
    // 1. Create Business Table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS business (
        id SERIAL PRIMARY KEY,
        nama_klien VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create Toko Table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS toko (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES business(id) ON DELETE CASCADE,
        nama_toko VARCHAR(150) NOT NULL,
        logo TEXT,
        alamat TEXT,
        no_hp VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Safety check: Add columns if table already existed before they were added
    await db.exec(`ALTER TABLE toko ADD COLUMN IF NOT EXISTS logo TEXT`);
    await db.exec(`ALTER TABLE toko ADD COLUMN IF NOT EXISTS alamat TEXT`);
    await db.exec(`ALTER TABLE toko ADD COLUMN IF NOT EXISTS no_hp VARCHAR(50)`);

    // 3. Add columns to users
    await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES business(id) ON DELETE CASCADE`);
    await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS toko_id INTEGER REFERENCES toko(id) ON DELETE CASCADE`);

    // 4. Add columns to barang
    await db.exec(`ALTER TABLE barang ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES business(id) ON DELETE CASCADE`);
    await db.exec(`ALTER TABLE barang ADD COLUMN IF NOT EXISTS toko_id INTEGER REFERENCES toko(id) ON DELETE CASCADE`);

    // 5. Add columns to supplier
    await db.exec(`ALTER TABLE supplier ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES business(id) ON DELETE CASCADE`);
    await db.exec(`ALTER TABLE supplier ADD COLUMN IF NOT EXISTS toko_id INTEGER REFERENCES toko(id) ON DELETE CASCADE`);
    
    // Fix unique constraint on supplier (supplier name was UNIQUE across the whole DB)
    await db.exec(`ALTER TABLE supplier DROP CONSTRAINT IF EXISTS supplier_nama_supplier_key`);
    await db.exec(`ALTER TABLE supplier ADD CONSTRAINT supplier_business_nama_unique UNIQUE (business_id, nama_supplier)`);

    // 6. Add columns to pelanggan
    await db.exec(`ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES business(id) ON DELETE CASCADE`);
    await db.exec(`ALTER TABLE pelanggan ADD COLUMN IF NOT EXISTS toko_id INTEGER REFERENCES toko(id) ON DELETE CASCADE`);

    // 7. Add columns to transaksi
    await db.exec(`ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES business(id) ON DELETE CASCADE`);
    await db.exec(`ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS toko_id INTEGER REFERENCES toko(id) ON DELETE CASCADE`);
    
    // Fix unique constraint on transaksi (nota_nomor was UNIQUE across the whole DB)
    await db.exec(`ALTER TABLE transaksi DROP CONSTRAINT IF EXISTS transaksi_nota_nomor_key`);
    await db.exec(`ALTER TABLE transaksi ADD CONSTRAINT transaksi_toko_nota_unique UNIQUE (toko_id, nota_nomor)`);

    // 8. Add columns to log_kerugian
    await db.exec(`ALTER TABLE log_kerugian ADD COLUMN IF NOT EXISTS business_id INTEGER REFERENCES business(id) ON DELETE CASCADE`);
    await db.exec(`ALTER TABLE log_kerugian ADD COLUMN IF NOT EXISTS toko_id INTEGER REFERENCES toko(id) ON DELETE CASCADE`);

    console.log("Tables altered successfully.");

    // 9. Insert Default Business and Toko for Existing Data
    const checkBusiness = await db.get(`SELECT id FROM business WHERE id = 1`);
    if (!checkBusiness) {
      await db.run(`INSERT INTO business (id, nama_klien) VALUES (1, 'Klien Pertama')`);
    }

    const checkToko = await db.get(`SELECT id FROM toko WHERE id = 1`);
    if (!checkToko) {
      await db.run(`INSERT INTO toko (id, business_id, nama_toko, alamat, no_hp) VALUES (1, 1, 'Toko Utama', 'Jl. Default No 1', '081234567890')`);
    }

    // 10. Update existing records
    await db.exec(`UPDATE users SET business_id = 1, toko_id = 1 WHERE business_id IS NULL AND username != 'root'`);
    await db.exec(`UPDATE barang SET business_id = 1, toko_id = 1 WHERE business_id IS NULL`);
    await db.exec(`UPDATE supplier SET business_id = 1, toko_id = 1 WHERE business_id IS NULL`);
    await db.exec(`UPDATE pelanggan SET business_id = 1, toko_id = 1 WHERE business_id IS NULL`);
    await db.exec(`UPDATE transaksi SET business_id = 1, toko_id = 1 WHERE business_id IS NULL`);
    await db.exec(`UPDATE log_kerugian SET business_id = 1, toko_id = 1 WHERE business_id IS NULL`);

    // 11. Fix roles and insert root
    // Existing 'admin' becomes 'superadmin'
    await db.exec(`UPDATE users SET role = 'superadmin' WHERE username = 'admin' AND role = 'owner'`);

    // Insert Root user (Pemilik Aplikasi KasirUKM)
    const checkRoot = await db.get(`SELECT id FROM users WHERE username = 'root'`);
    if (!checkRoot) {
      const password_hash = await bcrypt.hash('root123', 10);
      await db.run(
        `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'owner')`, 
        ['root', password_hash]
      );
    }

    // Reset sequences for business and toko in postgres
    try {
      await db.exec(`SELECT setval('business_id_seq', (SELECT MAX(id) FROM business))`);
      await db.exec(`SELECT setval('toko_id_seq', (SELECT MAX(id) FROM toko))`);
    } catch (seqErr) {
      console.log("Could not reset sequences (ignoring if sqlite or if they don't exist)", seqErr.message);
    }

    console.log("Migration completed successfully.");
    process.exit(0);

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
