const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

function parsePrivateKey(privateKey = '') {
  return privateKey.replace(/\\n/g, '\n');
}

function readServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (parsed.private_key) {
        parsed.private_key = parsePrivateKey(parsed.private_key);
      }
      return parsed;
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', error);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: parsePrivateKey(privateKey)
    };
  }

  return null;
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return { enabled: true, error: null };
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    return { enabled: false, error: null };
  }

  try {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID
    });

    return { enabled: true, error: null };
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error);
    return { enabled: false, error };
  }
}

const adminState = initializeFirebaseAdmin();

function isFirebaseAdminConfigured() {
  return adminState.enabled;
}

function getFirebaseAdminError() {
  return adminState.error || null;
}

function getAdminAuth() {
  if (!isFirebaseAdminConfigured()) {
    return null;
  }

  return getAuth();
}

module.exports = {
  getAdminAuth,
  getFirebaseAdminError,
  isFirebaseAdminConfigured
};
