const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { authenticate } = require('../middleware/auth');

// All exam routes require authentication
router.post('/', authenticate, examController.createExam);
router.get('/active', authenticate, examController.getActiveExams);
router.get('/:id', authenticate, examController.getExamById);
router.post('/sessions/start', authenticate, examController.startExamSession);
router.post('/sessions/submit', authenticate, examController.submitExamSession);
router.get('/sessions/history', authenticate, examController.getExamHistory);
router.get('/sessions/:id', authenticate, examController.getExamSession);

module.exports = router;
