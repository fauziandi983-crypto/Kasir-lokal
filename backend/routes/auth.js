const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public routes
router.post('/login', authController.login);
router.post('/register-public', authController.registerPublic);

// Protected routes (require login)
router.get('/me', authController.verifyToken, authController.me);
router.post('/register', authController.verifyToken, authController.register);
router.get('/users', authController.verifyToken, authController.getUsers);
router.delete('/users/:id', authController.verifyToken, authController.deleteUser);

module.exports = router;
