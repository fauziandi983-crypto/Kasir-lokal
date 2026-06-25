const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

let pool;

async function getDB() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      console.warn("DATABASE_URL belum diatur di file .env! Harap buat file .env dan isi dengan URL Supabase Anda.");
      throw new Error("DATABASE_URL tidak ditemukan.");
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  
  return {
    // Wrapper sederhana untuk menerjemahkan SQLite `?` menjadi PostgreSQL `$1`, `$2`
    all: async (sql, params = []) => {
      let count = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++count}`);
      const result = await pool.query(pgSql, params);
      return result.rows;
    },
    get: async (sql, params = []) => {
      let count = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++count}`);
      const result = await pool.query(pgSql, params);
      return result.rows[0];
    },
    run: async (sql, params = []) => {
      let count = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++count}`);
      const result = await pool.query(pgSql, params);
      return { lastID: result.rows[0]?.id || null, changes: result.rowCount };
    },
    exec: async (sql) => {
      await pool.query(sql);
    }
  };
}

async function initializeDatabase() {
  try {
    const db = await getDB();
    
    const sqlPath = path.join(__dirname, 'init.sql');
    const initSql = fs.readFileSync(sqlPath, 'utf8');
    
    await db.exec(initSql);
    console.log('PostgreSQL Database initialized successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

module.exports = { getDB, initializeDatabase };
