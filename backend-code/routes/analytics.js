const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

// All analytics routes require authentication
router.get('/violations', authenticate, analyticsController.getViolationAnalytics);
router.get('/sessions', authenticate, analyticsController.getExamSessionAnalytics);

module.exports = router;
