const { translateNeeds } = require('../services/geminiService');
const { buildNeedRecord, deleteDocument, setDocument } = require('../models/dataStore');
const {
  createDispatchLog,
  createNotification,
  getAssignments,
  getInventory,
  getNeedById,
  getNeeds,
  getVolunteers,
  hydrateNeed,
  logAuditEvent
} = require('../services/operationsService');

async function listNeeds(req, res) {
  try {
    const [needs, assignments, volunteers, inventory] = await Promise.all([getNeeds(), getAssignments(), getVolunteers(), getInventory()]);
    const orgId = req.query.orgId && req.query.orgId !== 'all' ? String(req.query.orgId) : null;
    const scopedNeeds = orgId ? needs.filter((need) => String(need.organizationId) === orgId) : needs;
    const hydratedNeeds = await Promise.all(scopedNeeds.map((need) => hydrateNeed(need, assignments, volunteers, inventory)));
    const language = req.query.lang ? String(req.query.lang) : 'en';
    const translatedNeeds = await translateNeeds(hydratedNeeds, language);
    res.json(translatedNeeds);
  } catch (error) {
    console.error('Needs fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch needs' });
  }
}

async function createNeed(req, res) {
  const newNeed = buildNeedRecord(req.body, req.user.uid);
  await setDocument('needs', newNeed.id, newNeed);

  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'dashboard'
    },
    action: 'need_created',
    entityType: 'need',
    entityId: newNeed.id,
    summary: `${newNeed.title} was created in ${newNeed.location}.`,
    metadata: {
      urgency: newNeed.urgency,
      category: newNeed.category,
      source: newNeed.source
    },
    severity: ['High', 'Critical'].includes(newNeed.urgency) ? 'high' : 'info'
  });

  if (['High', 'Critical'].includes(newNeed.urgency)) {
    await createNotification(
      'urgent_need',
      `${newNeed.urgency} need created`,
      `${newNeed.title} was added from ${newNeed.source || 'dashboard'} intake and needs attention in ${newNeed.location}.`
    );
  }

  res.status(201).json(await hydrateNeed(newNeed));
}

async function updateNeedOutcome(req, res) {
  const need = await getNeedById(req.params.id);
  if (!need) {
    return res.status(404).json({ success: false, error: 'Need not found' });
  }

  const nextOutcome = {
    status: req.body.status || need.outcome?.status || 'open',
    beneficiaryCount: Number(req.body.beneficiaryCount ?? need.outcome?.beneficiaryCount) || 0,
    summary: req.body.summary ?? need.outcome?.summary ?? '',
    updatedAt: new Date().toISOString(),
    updatedBy: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role
    },
    resolvedAt: req.body.status === 'resolved'
      ? (need.outcome?.resolvedAt || new Date().toISOString())
      : (req.body.status === 'closed' ? new Date().toISOString() : null)
  };

  const updatedNeed = {
    ...need,
    outcome: nextOutcome
  };

  await setDocument('needs', updatedNeed.id, updatedNeed);
  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'dashboard'
    },
    action: 'need_outcome_updated',
    entityType: 'need',
    entityId: updatedNeed.id,
    summary: `${updatedNeed.title} outcome updated to ${nextOutcome.status}.`,
    metadata: {
      beneficiaryCount: nextOutcome.beneficiaryCount,
      summary: nextOutcome.summary
    },
    severity: nextOutcome.status === 'resolved' ? 'info' : 'medium'
  });

  return res.json({ success: true, need: await hydrateNeed(updatedNeed) });
}

async function deleteNeed(req, res) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Only admins can delete needs' });
  }

  const need = await getNeedById(req.params.id);
  if (!need) {
    return res.status(404).json({ success: false, error: 'Need not found' });
  }

  const assignments = await getAssignments();
  const relatedAssignments = assignments.filter((assignment) => String(assignment.needId) === String(req.params.id));

  await Promise.all([
    deleteDocument('needs', req.params.id),
    ...relatedAssignments.map((assignment) => deleteDocument('assignments', assignment.id))
  ]);

  await createNotification(
    'review_queue',
    'Need removed by admin',
    `${need.title} was deleted from Mission Control because it was no longer necessary.`
  );
  await createDispatchLog(
    `Need deleted: ${need.title}`,
    need.location || 'Mission Control',
    'delivered',
    'admin-action'
  );
  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'dashboard'
    },
    action: 'need_deleted',
    entityType: 'need',
    entityId: req.params.id,
    summary: `${need.title} was deleted by admin review.`,
    metadata: {
      location: need.location,
      category: need.category,
      relatedAssignmentsRemoved: relatedAssignments.length
    },
    severity: 'high'
  });

  return res.json({ success: true, deletedId: String(req.params.id) });
}

module.exports = {
  createNeed,
  deleteNeed,
  listNeeds,
  updateNeedOutcome
};
