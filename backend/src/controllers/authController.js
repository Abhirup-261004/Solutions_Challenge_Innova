const { getUserProfile, setUserProfile } = require('../models/dataStore');
const { logAuditEvent } = require('../services/operationsService');

async function getProfile(req, res) {
  const profile = await getUserProfile(req.user.uid);
  res.json({
    success: true,
    profile: profile || {
      uid: req.user.uid,
      email: req.user.email || '',
      role: req.user.role || 'viewer',
      billing: {
        planId: 'community',
        planName: 'Community',
        status: 'active',
        provider: 'mock',
        billingCycle: 'monthly',
        amount: 0,
        currency: 'USD',
        renewalDate: null,
        customerId: null,
        subscriptionId: null,
        checkoutHistory: [],
        paymentHistory: []
      },
      training: {
        completedCourses: [],
        badges: [],
        certificates: [],
        attempts: []
      }
    }
  });
}

async function upsertProfile(req, res) {
  const previousProfile = await getUserProfile(req.user.uid);
  const profile = await setUserProfile(req.user.uid, {
    email: req.body.email || req.user.email || '',
    role: req.body.role || req.user.role || 'viewer',
    billing: req.body.billing,
    createdAt: req.body.createdAt
  });

  if (!previousProfile || previousProfile.role !== profile.role) {
    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: profile.email,
        role: profile.role,
        source: 'auth'
      },
      action: previousProfile ? 'role_updated' : 'profile_created',
      entityType: 'user_profile',
      entityId: req.user.uid,
      summary: previousProfile
        ? `User role changed from ${previousProfile.role} to ${profile.role}.`
        : `User profile created with role ${profile.role}.`,
      metadata: {
        previousRole: previousProfile?.role || null,
        nextRole: profile.role
      },
      severity: 'info'
    });
  }

  res.json({ success: true, profile });
}

module.exports = {
  getProfile,
  upsertProfile
};
