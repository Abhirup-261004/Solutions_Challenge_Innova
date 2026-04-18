const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getProfile, upsertProfile } = require('../controllers/authController');
const {
  confirmCheckoutSession,
  createCheckoutSession,
  getBillingSubscription,
  listBillingPlans
} = require('../controllers/billingController');
const { listAuditLogs } = require('../controllers/auditController');
const { acknowledgeEscalation, listEscalations } = require('../controllers/escalationController');
const { createInventoryItem, listInventory } = require('../controllers/inventoryController');
const { getOperationsInsights } = require('../controllers/insightsController');
const { createNeed, deleteNeed, listNeeds, updateNeedOutcome } = require('../controllers/needsController');
const { listTrainingCourses, submitTrainingCourse } = require('../controllers/trainingController');
const {
  approveReviewQueueItem,
  createReviewQueueItem,
  listReviewQueue,
  rejectReviewQueueItem
} = require('../controllers/reviewQueueController');
const {
  createVolunteer,
  deleteVolunteerProfile,
  getVolunteerProfile,
  listVolunteers,
  updateVolunteerProfile
} = require('../controllers/volunteerController');
const {
  createAssignment,
  listAssignments,
  updateAssignmentStatus,
  uploadAssignmentEvidence,
  verifyAssignmentCompletion
} = require('../controllers/assignmentController');
const {
  chatbot,
  createMarketplaceExchange,
  createMarketplaceListing,
  createNetworkRequest,
  getIncidentCommandOverview,
  getMatches,
  listIncidents,
  joinCommunity,
  getNetworkOverview,
  incomingSms,
  leaveCommunity,
  listOrganizations,
  listDispatchLogs,
  listNotifications,
  markNotificationsRead,
  scanNeedFromImage,
  updateNetworkRequestStatus
} = require('../controllers/systemController');

const router = express.Router();

router.get('/api/auth/profile', authMiddleware, getProfile);
router.put('/api/auth/profile', authMiddleware, upsertProfile);
router.get('/api/billing/plans', listBillingPlans);
router.get('/api/billing/subscription', authMiddleware, getBillingSubscription);
router.post('/api/billing/checkout', authMiddleware, createCheckoutSession);
router.patch('/api/billing/checkout/confirm', authMiddleware, confirmCheckoutSession);
router.get('/api/audit-logs', authMiddleware, listAuditLogs);
router.get('/api/escalations', authMiddleware, listEscalations);
router.patch('/api/escalations/:id/acknowledge', authMiddleware, acknowledgeEscalation);
router.get('/api/training/courses', authMiddleware, listTrainingCourses);
router.post('/api/training/courses/:id/submit', authMiddleware, submitTrainingCourse);
router.get('/api/insights/operations', authMiddleware, getOperationsInsights);

router.get('/api/needs', listNeeds);
router.post('/api/needs', authMiddleware, createNeed);
router.delete('/api/needs/:id', authMiddleware, deleteNeed);
router.patch('/api/needs/:id/outcome', authMiddleware, updateNeedOutcome);
router.get('/api/inventory', listInventory);
router.post('/api/inventory', authMiddleware, createInventoryItem);

router.post('/api/ocr/need', authMiddleware, scanNeedFromImage);

router.get('/api/review-queue', authMiddleware, listReviewQueue);
router.post('/api/review-queue', authMiddleware, createReviewQueueItem);
router.post('/api/community-reports', createReviewQueueItem);
router.patch('/api/review-queue/:id/approve', authMiddleware, approveReviewQueueItem);
router.patch('/api/review-queue/:id/reject', authMiddleware, rejectReviewQueueItem);

router.get('/api/volunteers', listVolunteers);
router.get('/api/volunteers/me', authMiddleware, getVolunteerProfile);
router.post('/api/volunteers', authMiddleware, createVolunteer);
router.put('/api/volunteers/me', authMiddleware, updateVolunteerProfile);
router.delete('/api/volunteers/me', authMiddleware, deleteVolunteerProfile);

router.get('/api/assignments', listAssignments);
router.post('/api/assignments', authMiddleware, createAssignment);
router.patch('/api/assignments/:id/status', authMiddleware, updateAssignmentStatus);
router.post('/api/assignments/:id/evidence', authMiddleware, uploadAssignmentEvidence);
router.patch('/api/assignments/:id/verify', authMiddleware, verifyAssignmentCompletion);

router.get('/api/matches', getMatches);
router.get('/api/organizations', listOrganizations);
router.get('/api/incidents', authMiddleware, listIncidents);
router.get('/api/incidents/:id/command', authMiddleware, getIncidentCommandOverview);
router.get('/api/network/overview', getNetworkOverview);
router.post('/api/network/marketplace/listings', authMiddleware, createMarketplaceListing);
router.post('/api/network/marketplace/exchanges', authMiddleware, createMarketplaceExchange);
router.post('/api/network/communities/:id/join', authMiddleware, joinCommunity);
router.delete('/api/network/communities/:id/leave', authMiddleware, leaveCommunity);
router.post('/api/network/requests', authMiddleware, createNetworkRequest);
router.patch('/api/network/requests/:id/status', authMiddleware, updateNetworkRequestStatus);
router.get('/api/dispatch-logs', listDispatchLogs);
router.get('/api/notifications', listNotifications);
router.post('/api/chatbot', chatbot);
router.patch('/api/notifications/read', authMiddleware, markNotificationsRead);
router.post('/api/sms/incoming', incomingSms);

module.exports = router;
