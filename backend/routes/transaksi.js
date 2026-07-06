const express = require('express');
const router = express.Router();
const transaksiController = require('../controllers/transaksiController');
const authController = require('../controllers/authController');

router.post('/checkout', authController.verifyToken, transaksiController.checkout);
router.get('/', authController.verifyToken, transaksiController.getTransaksi);
router.get('/hutang', authController.verifyToken, transaksiController.getHutang);
router.post('/:id/bayar-hutang', authController.verifyToken, transaksiController.bayarCicilan);

module.exports = router;
