const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const jwt = require('jsonwebtoken');

// Helper to get client IP
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         null;
};

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });
};

// Register User
exports.register = async (req, res) => {
  try {
    const { name, email, password, studentId } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      studentId: studentId || null,
      role: 'student'
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          studentId: user.studentId,
          role: user.role,
          createdAt: user.createdAt
        },
        token
      },
      message: 'Registration successful'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Login User
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || null;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      // Log failed login attempt
      await LoginLog.create({
        email: email.toLowerCase(),
        userId: null,
        status: 'failed',
        failureReason: 'User not found',
        ipAddress,
        userAgent
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Log failed login attempt
      await LoginLog.create({
        userId: user._id,
        email: user.email,
        status: 'failed',
        failureReason: 'Invalid password',
        ipAddress,
        userAgent
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Save login log to database
    await LoginLog.create({
      userId: user._id,
      email: user.email,
      status: 'success',
      ipAddress,
      userAgent
    });

    // Update user's lastLogin and loginCount
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      $inc: { loginCount: 1 }
    });

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          studentId: user.studentId,
          role: user.role,
          createdAt: user.createdAt
        },
        token
      },
      message: 'Login successful'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get Current User
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
      success: false,
      error: 'User not found'
    });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        role: user.role,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};
