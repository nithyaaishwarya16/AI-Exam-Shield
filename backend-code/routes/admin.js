const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require admin role
router.get('/violations', authenticate, requireAdmin, adminController.getAllViolations);
router.get('/violations/:id', authenticate, requireAdmin, adminController.getViolation);
router.patch('/violations/:id/review', authenticate, requireAdmin, adminController.reviewViolation);
router.get('/sessions', authenticate, requireAdmin, adminController.getAllExamSessions);
router.get('/sessions/:id/ai-summary', authenticate, requireAdmin, adminController.getExamSessionAiSummary);
router.get('/users', authenticate, requireAdmin, adminController.getAllUsers);
router.get('/exams', authenticate, requireAdmin, adminController.getAllExams);

module.exports = router;
