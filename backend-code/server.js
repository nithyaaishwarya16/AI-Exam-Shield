require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

function parseAllowedOrigins() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:8080';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// Middleware — browser sends Origin; it must match exactly. Vite with host "::" is often
// opened as http://127.0.0.1:8080 or http://<LAN-IP>:8080, which is not the same string as
// http://localhost:8080, so a single origin causes "Failed to fetch" on login.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const configured = parseAllowedOrigins();
    if (configured.includes(origin)) {
      return callback(null, true);
    }

    if (!isProduction) {
      try {
        const url = new URL(origin);
        const devPorts = new Set(['8080', '5173']);
        if (!devPorts.has(url.port)) {
          return callback(null, false);
        }
        const h = url.hostname.toLowerCase();
        const local =
          h === 'localhost' ||
          h === '127.0.0.1' ||
          h === '[::1]' ||
          h === '::1';
        const privateLan =
          /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
          /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
          /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h);
        if (local || privateLan) {
          return callback(null, true);
        }
      } catch {
        return callback(null, false);
      }
    }

    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Larger limit for screenshot base64

// MongoDB Connection
// Supports both local (mongodb://) and Atlas (mongodb+srv://)
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log('📊 Database:', mongoose.connection.name);
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error.message);
  process.exit(1);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/violations', require('./routes/violations'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
