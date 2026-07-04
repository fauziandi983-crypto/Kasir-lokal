const { getDB } = require('./db');

async function runMigration() {
  const db = await getDB();
  console.log("Starting activity_log migration...");

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        business_id INTEGER REFERENCES business(id) ON DELETE CASCADE,
        toko_id INTEGER REFERENCES toko(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
