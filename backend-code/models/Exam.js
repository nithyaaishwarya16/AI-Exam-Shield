const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['quiz', 'coding', 'essay', 'mixed'],
    default: 'quiz'
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  questions: [{
    question: String,
    type: {
      type: String,
      enum: ['multiple-choice', 'coding', 'essay'],
      default: 'multiple-choice'
    },
    options: [String],
    correctAnswer: mongoose.Schema.Types.Mixed,
    points: {
      type: Number,
      default: 1
    },
    order: Number
  }],
  settings: {
    allowTabSwitch: {
      type: Boolean,
      default: false
    },
    requireWebcam: {
      type: Boolean,
      default: true
    },
    requireMicrophone: {
      type: Boolean,
      default: true
    },
    recordVideo: {
      type: Boolean,
      default: true
    },
    maxViolations: {
      type: Number,
      default: 5
    },
    autoSubmitOnViolation: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

examSchema.index({ isActive: 1, startDate: 1 });

module.exports = mongoose.model('Exam', examSchema);
