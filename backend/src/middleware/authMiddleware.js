const { getAdminAuth, isFirebaseAdminConfigured } = require('../config/firebaseAdmin');
const { getUserProfile, setUserProfile } = require('../models/dataStore');
const { parseLocalAuthToken } = require('../utils/authToken');

async function hydrateLocalUser(localUser) {
  const profile = await getUserProfile(localUser.uid);

  if (!profile) {
    await setUserProfile(localUser.uid, {
      email: localUser.email || '',
      role: localUser.role || 'viewer'
    });
  }

  return {
    uid: localUser.uid,
    email: profile?.email || localUser.email || '',
    role: profile?.role || localUser.role || 'viewer',
    isMock: true
  };
}

async function verifyFirebaseUser(token) {
  const decodedToken = await getAdminAuth().verifyIdToken(token);
  const profile = await getUserProfile(decodedToken.uid);

  if (!profile) {
    await setUserProfile(decodedToken.uid, {
      email: decodedToken.email || '',
      role: 'viewer'
    });
  }

  return {
    uid: decodedToken.uid,
    email: profile?.email || decodedToken.email || '',
    role: profile?.role || 'viewer',
    isMock: false
  };
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  const localUser = parseLocalAuthToken(token);

  if (localUser) {
    req.user = await hydrateLocalUser(localUser);
    return next();
  }

  if (!isFirebaseAdminConfigured()) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid auth token' });
  }

  try {
    req.user = await verifyFirebaseUser(token);
    return next();
  } catch (error) {
    console.error('Firebase auth verification error:', error);
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Firebase token' });
  }
}

async function resolveOptionalUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  const localUser = parseLocalAuthToken(token);

  if (localUser) {
    return hydrateLocalUser(localUser);
  }

  if (!isFirebaseAdminConfigured()) {
    return null;
  }

  try {
    return await verifyFirebaseUser(token);
  } catch (error) {
    console.error('Optional auth verification error:', error);
    return null;
  }
}

module.exports = {
  authMiddleware,
  resolveOptionalUser
};
