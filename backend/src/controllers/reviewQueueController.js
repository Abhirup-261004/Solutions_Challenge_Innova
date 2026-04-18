const { buildNeedRecord, buildReviewItem, getDocument, setDocument } = require('../models/dataStore');
const {
  createDispatchLog,
  createNotification,
  getReviewQueue,
  hydrateNeed,
  logAuditEvent
} = require('../services/operationsService');

async function listReviewQueue(req, res) {
  const reviewQueue = await getReviewQueue();
  res.json(reviewQueue.filter((item) => item.status === 'pending'));
}

async function createReviewQueueItem(req, res) {
  const actor = req.user || {
    uid: 'community-public',
    email: req.body.contactEmail || '',
    role: 'community',
    source: req.body.source || 'community'
  };
  const reviewItem = buildReviewItem({
    ...req.body,
    source: req.body.source || 'ocr',
    submittedBy: actor.uid,
    contactName: req.body.contactName || '',
    contactEmail: req.body.contactEmail || '',
    contactPhone: req.body.contactPhone || ''
  });

  await setDocument('reviewQueue', reviewItem.id, reviewItem);
  await createNotification(
    'review_queue',
    'Draft submitted for approval',
    `${reviewItem.fields.title || 'Untitled need'} is waiting in the approval queue.`
  );
  await logAuditEvent({
    actor,
    action: 'review_item_created',
    entityType: 'review_queue',
    entityId: reviewItem.id,
    summary: `${reviewItem.fields.title || 'Untitled need'} was submitted for approval.`,
    metadata: {
      source: reviewItem.source,
      urgency: reviewItem.fields.urgency,
      contactName: req.body.contactName || '',
      contactEmail: req.body.contactEmail || ''
    },
    severity: 'info'
  });

  res.status(201).json({ success: true, reviewItem });
}

async function approveReviewQueueItem(req, res) {
  const reviewItem = await getDocument('reviewQueue', req.params.id);
  if (!reviewItem) {
    return res.status(404).json({ success: false, error: 'Review item not found' });
  }

  const mergedFields = {
    ...reviewItem.fields,
    ...req.body,
    volunteersNeeded: Number(req.body.volunteersNeeded ?? reviewItem.fields.volunteersNeeded) || 1
  };

  const updatedReviewItem = {
    ...reviewItem,
    fields: mergedFields,
    status: 'approved',
    reviewedAt: new Date().toISOString(),
    reviewedBy: req.user.uid
  };
  await setDocument('reviewQueue', updatedReviewItem.id, updatedReviewItem);

  const newNeed = buildNeedRecord(
    {
      ...mergedFields,
      source: reviewItem.source
    },
    req.user.uid
  );
  await setDocument('needs', newNeed.id, newNeed);

  if (['High', 'Critical'].includes(newNeed.urgency)) {
    await createNotification(
      'urgent_need',
      `${newNeed.urgency} need approved`,
      `${newNeed.title} has been approved from the ${reviewItem.source.toUpperCase()} queue and is now live.`
    );
  }

  await createDispatchLog(
    `Approval queue item approved: ${newNeed.title}`,
    `${reviewItem.source.toUpperCase()} intake`,
    'delivered',
    'review'
  );
  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'approval-queue'
    },
    action: 'review_item_approved',
    entityType: 'review_queue',
    entityId: updatedReviewItem.id,
    summary: `${newNeed.title} was approved and published from the ${reviewItem.source.toUpperCase()} queue.`,
    metadata: {
      source: reviewItem.source,
      publishedNeedId: newNeed.id,
      urgency: newNeed.urgency
    },
    severity: ['High', 'Critical'].includes(newNeed.urgency) ? 'high' : 'info'
  });

  res.json({ success: true, need: await hydrateNeed(newNeed), reviewItem: updatedReviewItem });
}

async function rejectReviewQueueItem(req, res) {
  const reviewItem = await getDocument('reviewQueue', req.params.id);
  if (!reviewItem) {
    return res.status(404).json({ success: false, error: 'Review item not found' });
  }

  const updatedReviewItem = {
    ...reviewItem,
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: req.user.uid,
    rejectionReason: req.body.reason || 'Rejected during coordinator review'
  };
  await setDocument('reviewQueue', updatedReviewItem.id, updatedReviewItem);

  await createNotification(
    'review_queue',
    'Draft rejected during review',
    `${reviewItem.fields.title || 'Untitled need'} was rejected and will not go live until resubmitted.`
  );
  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'approval-queue'
    },
    action: 'review_item_rejected',
    entityType: 'review_queue',
    entityId: updatedReviewItem.id,
    summary: `${reviewItem.fields.title || 'Untitled need'} was rejected during review.`,
    metadata: {
      source: reviewItem.source,
      reason: updatedReviewItem.rejectionReason
    },
    severity: 'warning'
  });

  res.json({ success: true, reviewItem: updatedReviewItem });
}

module.exports = {
  approveReviewQueueItem,
  createReviewQueueItem,
  listReviewQueue,
  rejectReviewQueueItem
};
