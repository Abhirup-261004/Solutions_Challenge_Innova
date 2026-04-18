const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || '';
let connectPromise = null;
let warnedAboutMongoFallback = false;
let lastMongoError = null;

function isMongoConfigured() {
  return Boolean(mongoUri);
}

function logMongoFallback(error, context) {
  lastMongoError = error;

  if (warnedAboutMongoFallback) {
    return;
  }

  warnedAboutMongoFallback = true;
  console.error(`MongoDB Atlas access failed during ${context}. Falling back to in-memory data.`, error);
}

async function connectMongo() {
  if (!isMongoConfigured()) {
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (!connectPromise) {
    connectPromise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS: 5000
      })
      .then(() => true)
      .catch((error) => {
        logMongoFallback(error, 'initial connection');
        connectPromise = null;
        return false;
      });
  }

  return connectPromise;
}

function getMongoError() {
  return lastMongoError;
}

module.exports = {
  connectMongo,
  getMongoError,
  isMongoConfigured,
  logMongoFallback,
  mongoose
};
