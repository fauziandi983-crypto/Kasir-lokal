const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000 // 5 seconds timeout
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Successfully connected to database!');
    release();
  }
  process.exit(err ? 1 : 0);
});
