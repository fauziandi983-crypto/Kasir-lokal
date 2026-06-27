const express = require('express');
const router = express.Router();
const tokoController = require('../controllers/tokoController');
const { verifyToken } = require('../controllers/authController');

router.get('/', verifyToken, tokoController.getToko);
router.put('/:id', verifyToken, tokoController.updateToko);

module.exports = router;
