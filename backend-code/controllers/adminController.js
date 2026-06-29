const Violation = require('../models/Violation');
const ExamSession = require('../models/ExamSession');
const User = require('../models/User');
const Exam = require('../models/Exam');

const FACE_RELATED_VIOLATION_TYPES = [
  'multiple-faces',
  'no-face',
  'face-obscured',
  'gaze-away',
  'identity-mismatch'
];

// Get all violations (admin only)
exports.getAllViolations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      type,
      startDate,
      endDate,
      faceOnly,
      hasScreenshot
    } = req.query;
    
    const matchStage = {};
    if (userId) matchStage.userId = userId;
    if (type) matchStage.type = type;
    if (faceOnly === 'true') {
      matchStage.type = { $in: FACE_RELATED_VIOLATION_TYPES };
    }
    if (hasScreenshot === 'true') {
      matchStage.screenshot = { $nin: [null, ''] };
    }
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }
    
    const violations = await Violation.find(matchStage)
      .populate('userId', 'name email studentId')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Violation.countDocuments(matchStage);
    const listData = violations.map((v) => ({
      ...v.toObject(),
      hasScreenshot: Boolean(v.screenshot)
    })).map((v) => {
      delete v.screenshot;
      return v;
    });
    
    res.json({
      success: true,
      data: listData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get violation with screenshot
exports.getViolation = async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id)
      .populate('userId', 'name email studentId');
    
    if (!violation) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }
    
    res.json({
      success: true,
      data: violation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Mark a violation review decision (benign/confirmed)
exports.reviewViolation = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!['benign', 'confirmed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid review status'
      });
    }

    const violation = await Violation.findById(req.params.id);
    if (!violation) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }

    violation.review = {
      status,
      note: note || null,
      reviewedBy: req.userId,
      reviewedAt: new Date()
    };
    await violation.save();

    res.json({
      success: true,
      data: violation,
      message: `Violation marked as ${status}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get all exam sessions (admin)
exports.getAllExamSessions = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, examId, status } = req.query;
    
    const matchStage = {};
    if (userId) matchStage.userId = userId;
    if (examId) matchStage.examId = examId;
    if (status) matchStage.status = status;
    
    const sessions = await ExamSession.find(matchStage)
      .populate('userId', 'name email studentId')
      .populate('examId', 'name type')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await ExamSession.countDocuments(matchStage);
    
    res.json({
      success: true,
      data: sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function computeHeuristicRisk(counts) {
  const get = (k) => Number(counts[k] || 0);
  // 0-100 rough heuristic; AI can refine when enabled
  let score = 0;
  score += Math.min(40, get('identity-mismatch') * 40);
  score += Math.min(30, get('multiple-faces') * 15);
  score += Math.min(20, get('no-face') * 6);
  score += Math.min(15, get('face-obscured') * 5);
  score += Math.min(10, get('gaze-away') * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// AI summary for a specific exam session (admin only)
exports.getExamSessionAiSummary = async (req, res) => {
  try {
    const sessionId = req.params.id;

    const session = await ExamSession.findById(sessionId)
      .populate('userId', 'name email studentId')
      .populate('examId', 'name type');

    if (!session) {
      return res.status(404).json({ success: false, error: 'Exam session not found' });
    }

    const violations = await Violation.find({ examSessionId: session._id })
      .sort({ timestamp: 1 })
      .select('type message timestamp screenshot');

    const counts = {};
    let faceScreenshotCount = 0;
    for (const v of violations) {
      counts[v.type] = (counts[v.type] || 0) + 1;
      if (FACE_RELATED_VIOLATION_TYPES.includes(v.type) && v.screenshot) {
        faceScreenshotCount += 1;
      }
    }

    const timeline = violations.map((v) => ({
      type: v.type,
      timestamp: v.timestamp,
      message: v.message,
      hasScreenshot: Boolean(v.screenshot) && FACE_RELATED_VIOLATION_TYPES.includes(v.type)
    }));

    const payload = {
      session: {
        id: String(session._id),
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        examName: session.examName,
        examType: session.examId?.type || null
      },
      student: {
        name: session.userId?.name || session.userName,
        email: session.userId?.email || session.userEmail,
        studentId: session.userId?.studentId || null
      },
      violations: {
        total: violations.length,
        countsByType: counts,
        faceScreenshotCount,
        timeline
      }
    };

    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // If no API key configured, return heuristic-only summary
    if (!apiKey) {
      const heuristicRisk = computeHeuristicRisk(counts);
      return res.json({
        success: true,
        data: {
          riskScore: heuristicRisk,
          flaggedReasons: Object.entries(counts)
            .filter(([, n]) => Number(n) > 0)
            .sort((a, b) => Number(b[1]) - Number(a[1]))
            .slice(0, 5)
            .map(([type, n]) => `${type}: ${n}`),
          summary: `Heuristic summary (AI not configured). ${violations.length} total violation(s), ${faceScreenshotCount} face-evidence screenshot(s).`,
          recommendedActions: [
            'Review face-evidence screenshots for the most severe timestamps',
            'Check identity-mismatch and multiple-faces events first'
          ],
          model: null
        },
        message: 'AI summary not enabled (missing OPENAI_API_KEY)'
      });
    }

    const system = [
      'You are an exam proctoring review assistant for admins.',
      'Your job: summarize why a session was flagged and prioritize manual review.',
      'You must output STRICT JSON only, no markdown, no extra text.',
      'Do not claim certainty; be conservative.',
      'Do not propose punitive actions; only recommend review steps.',
      '',
      'Return JSON schema:',
      '{',
      '  "riskScore": number,                // 0..100',
      '  "summary": string,                  // 2-5 sentences',
      '  "flaggedReasons": string[],         // 3-7 bullets',
      '  "recommendedActions": string[],     // 3-7 bullets',
      '  "topEvidence": Array<{',
      '     "timestamp": string,',
      '     "type": string,',
      '     "why": string,',
      '     "hasScreenshot": boolean',
      '  }>',
      '}'
    ].join('\n');

    const user = `Analyze this exam session payload:\n${JSON.stringify(payload)}`;

    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({
        success: false,
        error: `AI provider error: ${resp.status} ${txt}`
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return res.status(502).json({ success: false, error: 'AI provider returned empty response' });
    }

    const parsed = safeJsonParse(content);
    if (!parsed.ok) {
      return res.status(502).json({ success: false, error: 'AI response was not valid JSON' });
    }

    return res.json({
      success: true,
      data: { ...parsed.value, model },
      message: 'AI summary generated'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get all users (admin)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

// Get all exams (admin)
exports.getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find()
      .populate('createdBy', 'name email')
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
