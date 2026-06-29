const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    default: null
  },
  examName: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'submitted', 'auto-submitted', 'terminated'],
    default: 'in-progress'
  },
  videoRecordingUrl: {
    type: String,
    default: null // URL or path to video file
  },
  videoRecordingData: {
    type: String,
    default: null // Base64 or blob URL
  },
  violationCount: {
    type: Number,
    default: 0
  },
  score: {
    type: Number,
    default: null
  },
  answers: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

examSessionSchema.index({ userId: 1, createdAt: -1 });
examSessionSchema.index({ examId: 1 });

module.exports = mongoose.model('ExamSession', examSessionSchema);
