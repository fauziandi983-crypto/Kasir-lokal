const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authController = require('../controllers/authController');

// All dashboard endpoints require authentication
router.use(authController.verifyToken);

router.get('/summary', dashboardController.getSummary);
router.get('/bestsellers', dashboardController.getBestSellers);
router.get('/chart', dashboardController.getSalesChart);
router.get('/lowstock', dashboardController.getLowStockRecommendations);
router.get('/expiring', dashboardController.getExpiringItems);

module.exports = router;
