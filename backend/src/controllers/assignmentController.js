const { getDocument, setDocument } = require('../models/dataStore');
const {
  buildAssignmentView,
  createDispatchLog,
  createNotification,
  getAssignments,
  getNeedById,
  getVolunteerById,
  getVolunteers,
  hydrateNeed,
  logAuditEvent
} = require('../services/operationsService');
const { assignmentStatuses, summarizeStatus } = require('../utils/roleHelpers');
const { REWARD_POINTS, applyRewardEvent } = require('../utils/rewardHelpers');

async function listAssignments(req, res) {
  const needId = req.query.needId ? String(req.query.needId) : null;
  const orgId = req.query.orgId && req.query.orgId !== 'all' ? String(req.query.orgId) : null;
  const assignments = await getAssignments();
  const filtered = assignments
    .filter((assignment) => !needId || String(assignment.needId) === needId)
    .filter((assignment) => !orgId || String(assignment.organizationId) === orgId);
  const volunteers = await getVolunteers();
  const volunteersById = new Map(volunteers.map((volunteer) => [String(volunteer.id), volunteer]));
  res.json(await Promise.all(filtered.map((assignment) => buildAssignmentView(assignment, volunteersById))));
}

async function createAssignment(req, res) {
  const { needId, volunteerId } = req.body;
  const [need, volunteer, assignments] = await Promise.all([
    getNeedById(needId),
    getVolunteerById(volunteerId),
    getAssignments()
  ]);

  if (!need) {
    return res.status(404).json({ success: false, error: 'Need not found' });
  }

  if (!volunteer) {
    return res.status(404).json({ success: false, error: 'Volunteer not found' });
  }

  if (need.requiredBadge && !(volunteer.certifications || []).includes(need.requiredBadge)) {
    return res.status(400).json({
      success: false,
      error: `${volunteer.name} is missing the required certification badge: ${need.requiredBadge}`
    });
  }

  const duplicate = assignments.find(
    (assignment) =>
      String(assignment.needId) === String(needId) &&
      String(assignment.volunteerId) === String(volunteerId) &&
      assignment.status !== 'completed'
  );

  if (duplicate) {
    return res.status(409).json({ success: false, error: 'Volunteer is already assigned to this need' });
  }

  const assignment = {
    id: `a${Date.now()}`,
    needId: String(need.id),
    volunteerId: String(volunteer.id),
    organizationId: need.organizationId || volunteer.organizationId || 'org-central',
    organizationName: need.organizationName || volunteer.organizationName || 'Central Relief Network',
    organizationShortName: need.organizationShortName || volunteer.organizationShortName || 'CRN',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDocument('assignments', assignment.id, assignment);
  await createDispatchLog(`Assignment created: ${volunteer.name} linked to ${need.title}`, `${volunteer.name} • ${need.location}`, 'queued');
  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'dashboard'
    },
    action: 'assignment_created',
    entityType: 'assignment',
    entityId: assignment.id,
    summary: `${volunteer.name} was assigned to ${need.title}.`,
    metadata: {
      needId: need.id,
      volunteerId: volunteer.id,
      organizationId: assignment.organizationId,
      status: assignment.status
    },
    severity: 'info'
  });

  res.status(201).json({
    success: true,
    assignment: await buildAssignmentView(assignment),
    need: await hydrateNeed(need)
  });
}

async function updateAssignmentStatus(req, res) {
  const assignment = await getDocument('assignments', req.params.id);

  if (!assignment) {
    return res.status(404).json({ success: false, error: 'Assignment not found' });
  }

  const nextStatus = String(req.body.status || '').toLowerCase();
  if (!assignmentStatuses.includes(nextStatus)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  const wasCompleted = assignment.status === 'completed';
  const updatedAssignment = {
    ...assignment,
    status: nextStatus,
    updatedAt: new Date().toISOString()
  };
  await setDocument('assignments', updatedAssignment.id, updatedAssignment);

  const volunteer = await getVolunteerById(updatedAssignment.volunteerId);
  const need = await getNeedById(updatedAssignment.needId);

  let updatedVolunteer = volunteer;
  if (nextStatus === 'accepted' && assignment.status !== 'accepted' && volunteer && need) {
    updatedVolunteer = applyRewardEvent(
      {
        ...volunteer,
        updatedAt: new Date().toISOString()
      },
      {
        type: 'assignment_accepted',
        points: REWARD_POINTS.assignmentAccepted,
        summary: `Accepted assignment for ${need.title}.`,
        awardedAt: updatedAssignment.updatedAt,
        dedupeKey: `assignment-accepted:${updatedAssignment.id}`
      },
      {
        assignmentId: updatedAssignment.id,
        needId: updatedAssignment.needId,
        status: 'accepted',
        urgency: need.urgency,
        title: need.title,
        recordedAt: updatedAssignment.updatedAt
      }
    );
    await setDocument('volunteers', updatedVolunteer.id, updatedVolunteer);
  }

  if (nextStatus === 'completed' && !wasCompleted && volunteer && need) {
    updatedVolunteer = {
      ...volunteer,
      hoursVolunteered: Number(volunteer.hoursVolunteered || 0) + 4,
      missionsCompleted: Number(volunteer.missionsCompleted || 0) + 1,
      impactScore: Number(volunteer.impactScore || 0) + 55
    };
    updatedVolunteer = applyRewardEvent(
      updatedVolunteer,
      {
        type: 'assignment_completed',
        points: REWARD_POINTS.assignmentCompleted
          + (need.urgency === 'Critical' ? REWARD_POINTS.criticalAssignmentBonus : 0)
          + (need.urgency === 'High' ? REWARD_POINTS.highUrgencyBonus : 0),
        summary: `Completed assignment for ${need.title}.`,
        awardedAt: updatedAssignment.updatedAt,
        dedupeKey: `assignment-completed:${updatedAssignment.id}`,
        metadata: {
          urgency: need.urgency
        }
      },
      {
        assignmentId: updatedAssignment.id,
        needId: updatedAssignment.needId,
        status: 'completed',
        urgency: need.urgency,
        title: need.title,
        recordedAt: updatedAssignment.updatedAt
      }
    );
    await setDocument('volunteers', updatedVolunteer.id, updatedVolunteer);
  }

  if (nextStatus === 'accepted' && volunteer && need) {
    await createNotification(
      'assignment_accepted',
      'Volunteer accepted assignment',
      `${volunteer.name} accepted the assignment for ${need.title}.`
    );
  }

  await createDispatchLog(
    `Assignment updated: ${volunteer?.name || 'Volunteer'} is now ${summarizeStatus(nextStatus)} for ${need?.title || 'selected need'}`,
    `${volunteer?.name || 'Volunteer'} • ${need?.location || 'Unknown location'}`,
    nextStatus === 'completed' ? 'delivered' : 'queued'
  );
  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'dashboard'
    },
    action: 'assignment_status_updated',
    entityType: 'assignment',
    entityId: updatedAssignment.id,
    summary: `${volunteer?.name || 'Volunteer'} is now ${summarizeStatus(nextStatus)} for ${need?.title || 'selected need'}.`,
    metadata: {
      needId: updatedAssignment.needId,
      volunteerId: updatedAssignment.volunteerId,
      previousStatus: assignment.status,
      nextStatus
    },
    severity: nextStatus === 'completed' ? 'info' : 'warning'
  });

  res.json({
    success: true,
    assignment: await buildAssignmentView(updatedAssignment),
    need: need ? await hydrateNeed(need) : null,
    volunteer: updatedVolunteer || null
  });
}

async function uploadAssignmentEvidence(req, res) {
  const assignment = await getDocument('assignments', req.params.id);

  if (!assignment) {
    return res.status(404).json({ success: false, error: 'Assignment not found' });
  }

  const fileName = String(req.body.fileName || '').trim();
  const mimeType = String(req.body.mimeType || '').trim();
  const imageData = String(req.body.imageData || '').trim();
  const notes = String(req.body.notes || '').trim();

  if (!fileName || !mimeType || !imageData) {
    return res.status(400).json({ success: false, error: 'Evidence file is required' });
  }

  const uploadedAt = new Date().toISOString();
  const evidenceEntry = {
    id: `evidence-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    fileName,
    mimeType,
    imageData,
    notes,
    uploadedAt,
    uploadedBy: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role
    }
  };

  const updatedAssignment = {
    ...assignment,
    evidence: [...(Array.isArray(assignment.evidence) ? assignment.evidence : []), evidenceEntry],
    updatedAt: uploadedAt
  };

  await setDocument('assignments', updatedAssignment.id, updatedAssignment);

  const [volunteer, need] = await Promise.all([
    getVolunteerById(updatedAssignment.volunteerId),
    getNeedById(updatedAssignment.needId)
  ]);

  await createNotification(
    'field_evidence_uploaded',
    'New field evidence uploaded',
    `${volunteer?.name || 'A volunteer'} uploaded field evidence for ${need?.title || 'an assignment'}.`
  );
  await createDispatchLog(
    `Field evidence received from ${volunteer?.name || 'volunteer'} for ${need?.title || 'an assignment'}`,
    `${volunteer?.name || 'Volunteer'} • ${need?.location || 'Unknown location'}`,
    'delivered',
    'field-evidence'
  );
  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'dashboard'
    },
    action: 'assignment_evidence_uploaded',
    entityType: 'assignment',
    entityId: updatedAssignment.id,
    summary: `${volunteer?.name || 'Volunteer'} uploaded field evidence for ${need?.title || 'an assignment'}.`,
    metadata: {
      needId: updatedAssignment.needId,
      volunteerId: updatedAssignment.volunteerId,
      evidenceId: evidenceEntry.id,
      fileName: evidenceEntry.fileName
    },
    severity: 'info'
  });

  res.status(201).json({
    success: true,
    assignment: await buildAssignmentView(updatedAssignment),
    evidence: evidenceEntry,
    need: need ? await hydrateNeed(need) : null
  });
}

async function verifyAssignmentCompletion(req, res) {
  const assignment = await getDocument('assignments', req.params.id);

  if (!assignment) {
    return res.status(404).json({ success: false, error: 'Assignment not found' });
  }

  if (assignment.status !== 'completed') {
    return res.status(400).json({ success: false, error: 'Only completed assignments can be verified' });
  }

  if (assignment.verifiedCompletion?.status === 'verified') {
    return res.status(409).json({ success: false, error: 'Assignment has already been verified' });
  }

  const verifiedAt = new Date().toISOString();
  const updatedAssignment = {
    ...assignment,
    verifiedCompletion: {
      status: 'verified',
      verifiedAt,
      verifiedBy: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role
      }
    },
    updatedAt: verifiedAt
  };

  await setDocument('assignments', updatedAssignment.id, updatedAssignment);

  const [volunteer, need] = await Promise.all([
    getVolunteerById(updatedAssignment.volunteerId),
    getNeedById(updatedAssignment.needId)
  ]);

  let updatedVolunteer = volunteer;
  if (volunteer && need) {
    updatedVolunteer = applyRewardEvent(
      volunteer,
      {
        type: 'verified_completion',
        points: REWARD_POINTS.verifiedCompletionBonus,
        summary: `Coordinator verified completion for ${need.title}.`,
        awardedAt: verifiedAt,
        dedupeKey: `assignment-verified:${updatedAssignment.id}`,
        metadata: {
          urgency: need.urgency,
          hasEvidence: Array.isArray(updatedAssignment.evidence) && updatedAssignment.evidence.length > 0,
          evidenceCount: Array.isArray(updatedAssignment.evidence) ? updatedAssignment.evidence.length : 0
        }
      }
    );
    await setDocument('volunteers', updatedVolunteer.id, updatedVolunteer);
  }

  await createNotification(
    'assignment_verified',
    'Verified completion recorded',
    `${volunteer?.name || 'Volunteer'} received verified completion credit for ${need?.title || 'an assignment'}.`
  );
  await createDispatchLog(
    `Completion verified for ${volunteer?.name || 'volunteer'} on ${need?.title || 'an assignment'}`,
    `${volunteer?.name || 'Volunteer'} • ${need?.location || 'Unknown location'}`,
    'delivered',
    'verification'
  );
  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'dashboard'
    },
    action: 'assignment_verified',
    entityType: 'assignment',
    entityId: updatedAssignment.id,
    summary: `${volunteer?.name || 'Volunteer'} received verified completion for ${need?.title || 'an assignment'}.`,
    metadata: {
      needId: updatedAssignment.needId,
      volunteerId: updatedAssignment.volunteerId,
      evidenceCount: Array.isArray(updatedAssignment.evidence) ? updatedAssignment.evidence.length : 0
    },
    severity: 'info'
  });

  res.json({
    success: true,
    assignment: await buildAssignmentView(updatedAssignment),
    volunteer: updatedVolunteer || null,
    need: need ? await hydrateNeed(need) : null
  });
}

module.exports = {
  createAssignment,
  listAssignments,
  updateAssignmentStatus,
  uploadAssignmentEvidence,
  verifyAssignmentCompletion
};
