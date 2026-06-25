require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'POS System API is running.' });
});

// Import Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/barang', require('./routes/barang'));
app.use('/api/transaksi', require('./routes/transaksi')); 
app.use('/api/supplier', require('./routes/supplier'));
app.use('/api/dashboard', require('./routes/dashboard'));
// app.use('/api/pelanggan', require('./routes/pelanggan')); // To be implemented

// Start Server
async function startServer() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
