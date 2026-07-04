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

// Superadmin specific routes
router.get('/superadmin/activity-logs', authController.superAdminOnly, dashboardController.getActivityLogs);
router.get('/superadmin/stores-summary', authController.superAdminOnly, dashboardController.getStoresSummary);

module.exports = router;
