const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/summary', dashboardController.getSummary);
router.get('/bestsellers', dashboardController.getBestSellers);
router.get('/chart', dashboardController.getSalesChart);
router.get('/lowstock', dashboardController.getLowStockRecommendations);
router.get('/expiring', dashboardController.getExpiringItems);

module.exports = router;
