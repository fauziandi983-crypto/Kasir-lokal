const express = require('express');
const router = express.Router();
const multer = require('multer');
const backupController = require('../controllers/backupController');
const authController = require('../controllers/authController');

// Multer storage (in-memory) dengan batas ukuran file
// VULN-13 FIX: Tambahkan file size limit (5MB per file) untuk cegah upload file raksasa
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 4,                  // Maks 4 file sekaligus
  },
  fileFilter: (req, file, cb) => {
    // Hanya izinkan file CSV
    if (!file.originalname.match(/\.(csv)$/i)) {
      return cb(new Error('Hanya file CSV yang diizinkan'), false);
    }
    cb(null, true);
  }
});

// All backup routes require authentication
router.use(authController.verifyToken);

// Export (Download)
router.get('/export/barang', backupController.exportBarang);
router.get('/export/batch', backupController.exportBatch);
router.get('/export/transaksi', backupController.exportTransaksi);
router.get('/export/detail', backupController.exportDetail);

// Import (Restore)
router.post('/import-full', upload.fields([
  { name: 'file_barang', maxCount: 1 },
  { name: 'file_batch', maxCount: 1 },
  { name: 'file_transaksi', maxCount: 1 },
  { name: 'file_detail', maxCount: 1 }
]), backupController.importFull);

module.exports = router;
