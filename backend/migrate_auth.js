const { getDB } = require('./db');

async function runMigration() {
  const db = await getDB();
  console.log("Starting Auth features migration...");

  try {
    // Adding columns to users table
    
    const columnsToAdd = [
      "email VARCHAR(255) UNIQUE",
      "google_id VARCHAR(255) UNIQUE",
      "reset_token VARCHAR(255)",
      "reset_token_expiry TIMESTAMP"
    ];

    for (const col of columnsToAdd) {
      const colName = col.split(' ')[0];
      try {
        await db.run(`ALTER TABLE users ADD COLUMN ${col}`);
        console.log(`Added column ${colName} to users table.`);
      } catch (e) {
        if (e.message.includes('duplicate column name') || e.message.includes('already exists')) {
          console.log(`Column ${colName} already exists, skipping.`);
        } else {
          console.error(`Error adding column ${colName}:`, e.message);
        }
      }
    }

    console.log("Auth migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
