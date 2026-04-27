const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { getFirebaseAdminError } = require('./config/firebaseAdmin');
const { getMongoError, isMongoConfigured } = require('./config/db');

const app = express();

function parseAllowedOrigins() {
  const rawOrigins = [
    process.env.FRONTEND_ORIGIN,
    process.env.FRONTEND_ORIGINS
  ]
    .filter(Boolean)
    .join(',');

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOriginValue(origin) {
  return String(origin || '').trim().replace(/\/$/, '');
}

function originMatchesRule(origin, rule) {
  const normalizedOrigin = normalizeOriginValue(origin);
  const normalizedRule = normalizeOriginValue(rule);

  if (!normalizedOrigin || !normalizedRule) {
    return false;
  }

  if (normalizedRule === '*') {
    return true;
  }

  if (normalizedRule.startsWith('*.')) {
    try {
      const { hostname } = new URL(normalizedOrigin);
      const suffix = normalizedRule.slice(2);
      return hostname === suffix || hostname.endsWith(`.${suffix}`);
    } catch {
      return false;
    }
  }

  return normalizedOrigin === normalizedRule;
}

const allowedOrigins = parseAllowedOrigins();

app.set('trust proxy', 1);

app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.length === 0 ||
      allowedOrigins.some((rule) => originMatchesRule(origin, rule))
    ) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const firebaseAdminError = getFirebaseAdminError();
if (firebaseAdminError) {
  console.warn('Backend Firebase Admin could not initialize. Local demo auth fallback remains enabled.');
}

const mongoError = getMongoError();
if (mongoError) {
  console.warn('Backend is running in fallback data mode because MongoDB Atlas could not initialize.');
}

if (!isMongoConfigured()) {
  console.warn('MongoDB Atlas is not configured. Backend is using in-memory demo data.');
}

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Relief Operations backend is running.',
    docs: {
      health: '/api/health'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    mongoConfigured: isMongoConfigured(),
    firebaseAdminReady: !firebaseAdminError
  });
});

app.use(routes);

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON request body'
    });
  }

  console.error('Unhandled server error:', error);

  return res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

module.exports = app;
