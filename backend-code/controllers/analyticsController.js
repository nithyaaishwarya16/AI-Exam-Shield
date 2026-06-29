const Violation = require('../models/Violation');
const ExamSession = require('../models/ExamSession');
const User = require('../models/User');

// Get violation analytics
exports.getViolationAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, examId } = req.query;
    
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }
    
    // Get violations grouped by type
    const violationsByType = await Violation.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          violations: { $push: '$$ROOT' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Get violations by user
    const violationsByUser = await Violation.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          userName: { $first: '$userName' },
          userEmail: { $first: '$userEmail' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get violations over time (daily)
    const violationsOverTime = await Violation.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get total statistics
    const totalViolations = await Violation.countDocuments(matchStage);
    const totalUsers = await Violation.distinct('userId', matchStage).then(ids => ids.length);
    const totalSessions = await ExamSession.countDocuments({
      ...(examId && { examId }),
      violationCount: { $gt: 0 }
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalViolations,
          totalUsers,
          totalSessions,
          averageViolationsPerUser: totalUsers > 0 ? (totalViolations / totalUsers).toFixed(2) : 0
        },
        byType: violationsByType,
        byUser: violationsByUser,
        overTime: violationsOverTime
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get exam session analytics
exports.getExamSessionAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    
    const sessions = await ExamSession.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgViolations: { $avg: '$violationCount' },
          avgScore: { $avg: '$score' }
        }
      }
    ]);
    
    const totalSessions = await ExamSession.countDocuments(matchStage);
    const completedSessions = await ExamSession.countDocuments({
      ...matchStage,
      status: 'completed'
    });
    
    res.json({
      success: true,
      data: {
        totalSessions,
        completedSessions,
        completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(2) : 0,
        byStatus: sessions
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};
