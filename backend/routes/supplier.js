const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const authController = require('../controllers/authController');

router.use(authController.verifyToken);

router.get('/', supplierController.getSuppliers);
router.post('/', supplierController.createSupplier);

module.exports = router;
