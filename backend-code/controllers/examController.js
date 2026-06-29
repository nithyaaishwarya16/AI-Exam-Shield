const Exam = require('../models/Exam');
const ExamSession = require('../models/ExamSession');
const Violation = require('../models/Violation');

// Create new exam (admin only)
exports.createExam = async (req, res) => {
  try {
    const examData = {
      ...req.body,
      createdBy: req.userId
    };
    const exam = await Exam.create(examData);
    res.status(201).json({
      success: true,
      data: exam,
      message: 'Exam created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get all active exams
exports.getActiveExams = async (req, res) => {
  try {
    const exams = await Exam.find({ isActive: true })
      .select('-questions.correctAnswer') // Don't expose answers
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: exams
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get exam by ID
exports.getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .select('-questions.correctAnswer');
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found'
      });
    }
    
    res.json({
      success: true,
      data: exam
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Start exam session
exports.startExamSession = async (req, res) => {
  try {
    const { examId } = req.body;
    
    // Check if user already has an active session
    const activeSession = await ExamSession.findOne({
      userId: req.userId,
      status: 'in-progress'
    });
    
    if (activeSession) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active exam session'
      });
    }

    let exam = null;
    if (examId) {
      exam = await Exam.findById(examId);
      if (!exam || !exam.isActive) {
        return res.status(404).json({
          success: false,
          error: 'Exam not found or inactive'
        });
      }
    } else {
      // Fallback: if no examId is provided, use first active exam if present,
      // otherwise create a generic proctoring session so admin analytics still work.
      exam = await Exam.findOne({ isActive: true }).sort({ createdAt: -1 });
    }

    const session = await ExamSession.create({
      userId: req.userId,
      examId: exam?._id || null,
      examName: exam?.name || 'General Proctored Session',
      duration: exam?.duration || 30,
      status: 'in-progress'
    });
    
    res.status(201).json({
      success: true,
      data: session,
      message: 'Exam session started'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Submit exam session
exports.submitExamSession = async (req, res) => {
  try {
    const { sessionId, answers, videoRecordingData } = req.body;
    
    const session = await ExamSession.findOne({
      _id: sessionId,
      userId: req.userId
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Exam session not found'
      });
    }
    
    if (session.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        error: 'Exam session already submitted'
      });
    }
    
    // Get violation count
    const violationCount = await Violation.countDocuments({
      userId: req.userId,
      examSessionId: session._id.toString()
    });
    
    // Calculate score if exam has questions
    let score = null;
    if (answers && Object.keys(answers).length > 0) {
      const exam = await Exam.findById(session.examId);
      if (exam && exam.questions) {
        let totalScore = 0;
        let maxScore = 0;
        
        exam.questions.forEach((q, index) => {
          maxScore += q.points || 1;
          const userAnswer = answers[index] || answers[q._id];
          if (userAnswer === q.correctAnswer || 
              (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(userAnswer))) {
            totalScore += q.points || 1;
          }
        });
        
        score = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      }
    }
    
    session.endTime = new Date();
    session.status = 'submitted';
    session.answers = answers || {};
    session.videoRecordingData = videoRecordingData || null;
    session.violationCount = violationCount;
    session.score = score;
    
    await session.save();
    
    res.json({
      success: true,
      data: session,
      message: 'Exam submitted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get user's exam history
exports.getExamHistory = async (req, res) => {
  try {
    const sessions = await ExamSession.find({ userId: req.userId })
      .populate('examId', 'name type')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get exam session details
exports.getExamSession = async (req, res) => {
  try {
    const session = await ExamSession.findById(req.params.id)
      .populate('examId', 'name type')
      .populate('userId', 'name email studentId');
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Exam session not found'
      });
    }
    
    // Only allow access if user is owner or admin
    if (session.userId._id.toString() !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};
