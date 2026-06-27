const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.register);

// Protected routes (require login)
router.get('/me', authController.verifyToken, authController.me);

// Owner-only routes
router.get('/users', authController.verifyToken, authController.ownerOnly, authController.getUsers);
router.delete('/users/:id', authController.verifyToken, authController.ownerOnly, authController.deleteUser);

module.exports = router;
