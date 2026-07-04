const express = require('express');
const router = express.Router();
const barangController = require('../controllers/barangController');
const authController = require('../controllers/authController');

router.use(authController.verifyToken);

router.get('/', barangController.getAllBarang);
router.get('/monitoring', barangController.getMonitoringStok);
router.get('/preview-expired', barangController.previewExpired);
router.get('/laporan-kerugian', barangController.getLaporanKerugian);
router.post('/buang-expired', barangController.buangExpired);
router.post('/', barangController.createBarang);
router.put('/:id/harga', barangController.updateHarga);
router.put('/:id/master', barangController.updateMaster);
router.get('/:barang_id/batches', barangController.getBatches);
router.post('/:barang_id/batches', barangController.createBatch);
router.post('/:id/barcodes', barangController.addBarcode);
router.get('/:id/riwayat-harga', barangController.getRiwayatHarga);
router.delete('/:id', barangController.deleteBarang);

module.exports = router;
