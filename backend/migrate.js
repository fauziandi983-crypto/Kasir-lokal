const { getDB } = require('./db');

async function migrate() {
  const db = await getDB();
  try {
    // Check if column exists
    const tableInfo = await db.all("PRAGMA table_info(barang)");
    const hasKategori = tableInfo.some(col => col.name === 'kategori');
    
    if (!hasKategori) {
      console.log('Adding kategori column to barang table...');
      await db.run("ALTER TABLE barang ADD COLUMN kategori TEXT DEFAULT 'Umum'");
      console.log('Migration successful.');
    } else {
      console.log('Column kategori already exists.');
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
  }
}

migrate();
