const express = require('express');
const router = express.Router();
const violationController = require('../controllers/violationController');
const { authenticate } = require('../middleware/auth');

// All violation routes require authentication
router.post('/', authenticate, violationController.reportViolation);
router.get('/', authenticate, violationController.getUserViolations);

module.exports = router;
