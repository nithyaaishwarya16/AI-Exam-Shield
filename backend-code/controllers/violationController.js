const Violation = require('../models/Violation');
const User = require('../models/User');

// Report violation with screenshot
exports.reportViolation = async (req, res) => {
  try {
    const { type, message, timestamp, screenshot } = req.body;

    if (!type || !message) {
      return res.status(400).json({
        success: false,
        error: 'Type and message are required'
      });
    }

    const user = await User.findById(req.userId).select('name email');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const violation = await Violation.create({
      userId: req.userId,
      userEmail: user.email,
      userName: user.name,
      type,
      message,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      screenshot: screenshot || null,
      examSessionId: req.body.examSessionId || null
    });

    res.status(201).json({
      success: true,
      data: {
        _id: violation._id,
        type: violation.type,
        message: violation.message,
        timestamp: violation.timestamp,
        hasScreenshot: !!violation.screenshot
      },
      message: 'Violation reported with screenshot'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get violations for a user (for admin/review)
exports.getUserViolations = async (req, res) => {
  try {
    const violations = await Violation.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .select('-screenshot'); // Exclude large screenshot in list

    res.json({
      success: true,
      data: violations
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};
