const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { getFirebaseAdminError } = require('./config/firebaseAdmin');
const { getMongoError, isMongoConfigured } = require('./config/db');

const app = express();

app.use(cors());
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
