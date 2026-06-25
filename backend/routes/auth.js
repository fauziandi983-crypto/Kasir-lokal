const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public routes
router.post('/login', authController.login);

// Protected routes (require login)
router.get('/me', authController.verifyToken, authController.me);

// Owner-only routes
router.post('/register', authController.verifyToken, authController.ownerOnly, authController.register);
router.get('/users', authController.verifyToken, authController.ownerOnly, authController.getUsers);
router.delete('/users/:id', authController.verifyToken, authController.ownerOnly, authController.deleteUser);

module.exports = router;
