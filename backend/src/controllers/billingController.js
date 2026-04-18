const { getUserProfile, setUserProfile } = require('../models/dataStore');
const { logAuditEvent } = require('../services/operationsService');

const billingPlans = [
  {
    id: 'community',
    name: 'Community',
    priceLabel: 'Free',
    amount: 0,
    currency: 'USD',
    billingCycle: 'monthly',
    audience: 'Local groups, student teams, and early pilot programs.',
    recommended: false,
    features: [
      'Need intake, approval queue, and volunteer registration',
      'Basic assignments, notifications, and transparency page',
      'Essential training and community reporting'
    ]
  },
  {
    id: 'pro',
    name: 'Pro Coordination',
    priceLabel: '$49/mo',
    amount: 49,
    currency: 'USD',
    billingCycle: 'monthly',
    audience: 'Growing NGOs, district teams, and recurring response programs.',
    recommended: true,
    features: [
      'Advanced analytics, exports, and richer reporting',
      'Audit visibility, billing controls, and governance workflows',
      'Marketplace exchange, donor visibility, and support history'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise Response',
    priceLabel: 'Custom',
    amount: 199,
    currency: 'USD',
    billingCycle: 'monthly',
    audience: 'Governments, city programs, donor coalitions, and large nonprofits.',
    recommended: false,
    features: [
      'Multi-organization deployments and advanced governance',
      'Institutional reporting, white-labeling, and premium support',
      'Custom onboarding, dedicated billing, and integration readiness'
    ]
  }
];

function getPlan(planId = 'community') {
  return billingPlans.find((plan) => plan.id === String(planId)) || billingPlans[0];
}

function buildDefaultBilling() {
  const plan = getPlan('community');
  return {
    planId: plan.id,
    planName: plan.name,
    status: 'active',
    provider: 'mock',
    billingCycle: plan.billingCycle,
    amount: plan.amount,
    currency: plan.currency,
    renewalDate: null,
    customerId: null,
    subscriptionId: null,
    checkoutHistory: [],
    paymentHistory: []
  };
}

async function listBillingPlans(req, res) {
  return res.json({ success: true, plans: billingPlans });
}

async function getBillingSubscription(req, res) {
  const profile = await getUserProfile(req.user.uid);
  const billing = profile?.billing || buildDefaultBilling();
  return res.json({
    success: true,
    subscription: billing,
    plan: getPlan(billing.planId)
  });
}

async function createCheckoutSession(req, res) {
  try {
    const plan = getPlan(req.body.planId);
    const provider = ['mock', 'stripe', 'razorpay'].includes(String(req.body.provider || 'mock'))
      ? String(req.body.provider || 'mock')
      : 'mock';
    const profile = await getUserProfile(req.user.uid);
    const existingBilling = profile?.billing || buildDefaultBilling();
    const now = new Date().toISOString();

    const checkoutSession = {
      id: `checkout-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      provider,
      planId: plan.id,
      planName: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      status: provider === 'mock' ? 'ready_for_confirmation' : 'pending_provider_setup',
      createdAt: now
    };

    await setUserProfile(req.user.uid, {
      email: profile?.email || req.user.email || '',
      role: profile?.role || req.user.role || 'viewer',
      displayName: profile?.displayName || '',
      createdAt: profile?.createdAt,
      communityMemberships: profile?.communityMemberships,
      training: profile?.training,
      billing: {
        ...existingBilling,
        checkoutHistory: [
          checkoutSession,
          ...(Array.isArray(existingBilling.checkoutHistory) ? existingBilling.checkoutHistory : [])
        ].slice(0, 12)
      }
    });

    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        source: 'billing'
      },
      action: 'billing_checkout_created',
      entityType: 'billing_checkout',
      entityId: checkoutSession.id,
      summary: `Checkout started for ${plan.name}.`,
      metadata: {
        planId: plan.id,
        provider
      },
      severity: 'info'
    });

    return res.status(201).json({
      success: true,
      checkout: checkoutSession,
      message: provider === 'mock'
        ? 'Mock checkout created. Confirm it to activate the plan immediately.'
        : `Provider ${provider} is scaffolded. Add live credentials and webhook wiring to complete real payment capture.`
    });
  } catch (error) {
    console.error('Billing checkout error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
}

async function confirmCheckoutSession(req, res) {
  try {
    const plan = getPlan(req.body.planId);
    const provider = ['mock', 'stripe', 'razorpay'].includes(String(req.body.provider || 'mock'))
      ? String(req.body.provider || 'mock')
      : 'mock';
    const profile = await getUserProfile(req.user.uid);
    const existingBilling = profile?.billing || buildDefaultBilling();
    const paidAt = new Date().toISOString();
    const renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const paymentRecord = {
      id: `payment-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      planId: plan.id,
      planName: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      provider,
      status: 'paid',
      paidAt
    };

    const nextBilling = {
      ...existingBilling,
      planId: plan.id,
      planName: plan.name,
      status: 'active',
      provider,
      billingCycle: plan.billingCycle,
      amount: plan.amount,
      currency: plan.currency,
      renewalDate,
      subscriptionId: existingBilling.subscriptionId || `sub-${req.user.uid}-${plan.id}`,
      customerId: existingBilling.customerId || `cus-${req.user.uid}`,
      paymentHistory: [
        paymentRecord,
        ...(Array.isArray(existingBilling.paymentHistory) ? existingBilling.paymentHistory : [])
      ].slice(0, 20),
      checkoutHistory: (Array.isArray(existingBilling.checkoutHistory) ? existingBilling.checkoutHistory : []).map((entry, index) => (
        index === 0
          ? { ...entry, status: 'completed', completedAt: paidAt }
          : entry
      ))
    };

    const updatedProfile = await setUserProfile(req.user.uid, {
      email: profile?.email || req.user.email || '',
      role: profile?.role || req.user.role || 'viewer',
      displayName: profile?.displayName || '',
      createdAt: profile?.createdAt,
      communityMemberships: profile?.communityMemberships,
      training: profile?.training,
      billing: nextBilling
    });

    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        source: 'billing'
      },
      action: 'billing_subscription_activated',
      entityType: 'user_profile',
      entityId: req.user.uid,
      summary: `${plan.name} activated for ${req.user.email || req.user.uid}.`,
      metadata: {
        planId: plan.id,
        provider,
        amount: plan.amount
      },
      severity: 'info'
    });

    return res.json({
      success: true,
      subscription: updatedProfile.billing,
      plan
    });
  } catch (error) {
    console.error('Billing confirmation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to confirm checkout session' });
  }
}

module.exports = {
  confirmCheckoutSession,
  createCheckoutSession,
  getBillingSubscription,
  listBillingPlans
};
