const { buildVolunteerRecommendations, extractNeedFromImage, generateChatbotReply, getSmartMatches } = require('../services/geminiService');
const {
  buildMarketplaceListing,
  buildNetworkRequest,
  buildReviewItem,
  getDocument,
  getUserProfile,
  listCollection,
  setDocument,
  setUserProfile,
  updateDocument
} = require('../models/dataStore');
const {
  createDispatchLog,
  createNotification,
  getAuditLogs,
  getAssignments,
  getDispatchLogs,
  getMarketplaceListings,
  getNetworkRequests,
  getOrganizations,
  getInventory,
  getNeeds,
  getNotifications,
  getReviewQueue,
  getVolunteers,
  hydrateNeed,
  logAuditEvent
} = require('../services/operationsService');
const { resolveOptionalUser } = require('../middleware/authMiddleware');

function rankPriorityLabel(score = 0) {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'watch';
  return 'normal';
}

function canManageNetworkRequests(user) {
  return ['admin', 'coordinator'].includes(user?.role);
}

function normalizeNetworkStatus(status = 'requested') {
  const map = {
    open: 'requested',
    committed: 'approved_support',
    completed: 'closed'
  };

  return map[String(status)] || String(status);
}

function networkRequestStatusLabel(status = 'requested') {
  const normalized = normalizeNetworkStatus(status);
  if (normalized === 'approved_support') return 'Support Approved';
  if (normalized === 'in_transit') return 'In Transit';
  if (normalized === 'delivered') return 'Delivered';
  if (normalized === 'verified') return 'Verified';
  if (normalized === 'closed') return 'Closed';
  if (normalized === 'cancelled') return 'Cancelled';
  return 'Requested';
}

function cloneActor(user, fallbackSource = 'network-board') {
  return {
    uid: user?.uid || 'system',
    email: user?.email || '',
    role: user?.role || 'system',
    source: fallbackSource
  };
}

function appendNetworkHistory(request, { type, note, actor, status }) {
  return [
    ...(Array.isArray(request.history) ? request.history : []),
    {
      id: `network-history-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      status,
      note,
      actor: cloneActor(actor),
      createdAt: new Date().toISOString()
    }
  ];
}

function getAllowedTransition(currentStatus = 'requested', action = '') {
  const normalizedStatus = normalizeNetworkStatus(currentStatus);
  const normalizedAction = String(action || '').toLowerCase();

  const actionMap = {
    approve_support: 'approved_support',
    mark_in_transit: 'in_transit',
    confirm_delivery: 'delivered',
    verify_receipt: 'verified',
    close_request: 'closed',
    cancel_request: 'cancelled'
  };

  if (!normalizedAction) {
    return null;
  }

  const nextStatus = actionMap[normalizedAction] || normalizeNetworkStatus(normalizedAction);
  const legalTransitions = {
    requested: ['approved_support', 'cancelled'],
    approved_support: ['in_transit', 'cancelled'],
    in_transit: ['delivered', 'cancelled'],
    delivered: ['verified', 'cancelled'],
    verified: ['closed'],
    closed: [],
    cancelled: []
  };

  if (!legalTransitions[normalizedStatus]?.includes(nextStatus)) {
    return null;
  }

  return nextStatus;
}

function buildNetworkSummary(requests = []) {
  const normalizedRequests = requests.map((request) => ({
    ...request,
    status: normalizeNetworkStatus(request.status)
  }));

  const average = (items, mapper) => {
    if (!items.length) return 0;
    return Math.round(items.reduce((sum, item) => sum + mapper(item), 0) / items.length);
  };

  const hoursBetween = (start, end) => {
    const startTs = new Date(start || '').getTime();
    const endTs = new Date(end || '').getTime();
    if (Number.isNaN(startTs) || Number.isNaN(endTs) || endTs < startTs) return 0;
    return (endTs - startTs) / 3600000;
  };

  const approved = normalizedRequests.filter((request) => request.approvals?.supportingApprovedAt);
  const delivered = normalizedRequests.filter((request) => request.approvals?.deliveryConfirmedAt);
  const verified = normalizedRequests.filter((request) => request.approvals?.receiptVerifiedAt);

  return {
    totalRequests: normalizedRequests.length,
    activeRequests: normalizedRequests.filter((request) => ['requested', 'approved_support', 'in_transit', 'delivered', 'verified'].includes(request.status)).length,
    verifiedRequests: verified.length,
    closedRequests: normalizedRequests.filter((request) => request.status === 'closed').length,
    fulfillmentRate: normalizedRequests.length ? Math.round((verified.length / normalizedRequests.length) * 100) : 0,
    averageApprovalHours: average(approved, (request) => hoursBetween(request.createdAt, request.approvals.supportingApprovedAt)),
    averageDeliveryHours: average(delivered, (request) => hoursBetween(request.approvals?.supportingApprovedAt || request.createdAt, request.approvals.deliveryConfirmedAt)),
    averageVerificationHours: average(verified, (request) => hoursBetween(request.approvals?.deliveryConfirmedAt || request.createdAt, request.approvals.receiptVerifiedAt))
  };
}

function sortByMostRecent(items = [], accessor = (item) => item?.createdAt) {
  return items
    .slice()
    .sort((left, right) => String(accessor(right) || '').localeCompare(String(accessor(left) || '')));
}

function formatIncidentStatus(status = 'active') {
  return String(status)
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function buildIncidentLeadershipBrief({ incident, needs, escalations, assignments, inventory, networkRequests }) {
  const openSpots = needs.reduce((sum, need) => sum + Number(need.openSpots || 0), 0);
  const criticalNeeds = needs.filter((need) => need.urgency === 'Critical').length;
  const lowInventoryCount = inventory.filter((item) => Number(item.quantity || 0) <= Number(item.threshold || 0)).length;
  const activeRequests = networkRequests.filter((request) => ['requested', 'approved_support', 'in_transit', 'delivered', 'verified'].includes(request.status)).length;
  const activeAssignments = assignments.filter((assignment) => assignment.status !== 'completed').length;

  return `${incident.name} is ${formatIncidentStatus(incident.status).toLowerCase()} with ${needs.length} live need${needs.length === 1 ? '' : 's'}, ${criticalNeeds} critical frontline pressure point${criticalNeeds === 1 ? '' : 's'}, and ${openSpots} open staffing slot${openSpots === 1 ? '' : 's'}. ${activeAssignments} active assignment${activeAssignments === 1 ? '' : 's'} are currently supporting the response, ${escalations.length} escalation${escalations.length === 1 ? '' : 's'} need leadership visibility, and ${lowInventoryCount} inventory constraint${lowInventoryCount === 1 ? '' : 's'} could slow execution. ${activeRequests ? `${activeRequests} mutual-aid workflow${activeRequests === 1 ? ' is' : 's are'} in motion across partner organizations.` : 'No mutual-aid workflow is currently open, so local capacity must carry the response.'}`;
}

function buildIncidentReadiness({ summary, escalations, lowInventoryCount, activeRequests }) {
  const readiness = Math.max(
    0,
    100
      - Number(summary.openSpots || 0) * 5
      - Number(escalations.length || 0) * 8
      - Number(lowInventoryCount || 0) * 6
      + Math.min(Number(activeRequests || 0) * 4, 12)
  );

  let label = 'Stabilized';
  if (readiness < 45) label = 'Fragile';
  else if (readiness < 70) label = 'Watch';

  return {
    score: readiness,
    label,
    narrative: readiness < 45
      ? 'Command posture is fragile. Immediate staffing and supply intervention is recommended.'
      : readiness < 70
        ? 'Command posture is stable but exposed. Monitor staffing and resource gaps closely.'
        : 'Command posture is healthy enough to absorb new pressure with close coordination.'
  };
}

function buildIncidentRecommendations({ incident, needs, escalations, openSpots, lowInventory, networkRequests, assignments }) {
  const actions = [];
  const topEscalation = escalations[0];
  const topLowInventory = lowInventory[0];
  const pendingMutualAid = networkRequests.find((request) => ['requested', 'approved_support'].includes(request.status));
  const inactiveNeeds = needs.filter((need) => Number(need.openSpots || 0) > 0).length;

  if (topEscalation) {
    actions.push({
      id: 'recommendation-escalation',
      priority: 'critical',
      title: `Close the gap on ${topEscalation.title}`,
      detail: `${topEscalation.location} is currently the highest-risk operational gap with a score of ${topEscalation.escalation?.score || 0}/100.`
    });
  }

  if (topLowInventory) {
    actions.push({
      id: 'recommendation-inventory',
      priority: 'high',
      title: `Replenish ${topLowInventory.name}`,
      detail: `${topLowInventory.location} is below its threshold and may constrain incident throughput.`
    });
  }

  if (pendingMutualAid) {
    actions.push({
      id: 'recommendation-network',
      priority: 'high',
      title: 'Advance the mutual-aid workflow',
      detail: `${pendingMutualAid.requestingOrganizationShortName} to ${pendingMutualAid.supportingOrganizationShortName} still needs operational follow-through.`
    });
  }

  if (openSpots > 0) {
    actions.push({
      id: 'recommendation-staffing',
      priority: openSpots >= 5 ? 'high' : 'watch',
      title: 'Increase staffing depth',
      detail: `${openSpots} open volunteer slot${openSpots === 1 ? '' : 's'} remain across ${inactiveNeeds} active need${inactiveNeeds === 1 ? '' : 's'}.`
    });
  }

  if (!actions.length) {
    actions.push({
      id: 'recommendation-monitoring',
      priority: 'normal',
      title: 'Maintain current command posture',
      detail: `${incident.name} has no immediate blockers beyond routine monitoring and cadence updates.`
    });
  }

  return actions.slice(0, 4);
}

function buildIncidentPhaseStatus(incident, { summary, readiness }) {
  const phases = Array.isArray(incident.phases) && incident.phases.length ? incident.phases : ['Assessment', 'Deployment', 'Stabilization', 'Recovery'];
  const activeIndex = readiness.score < 45
    ? Math.min(1, phases.length - 1)
    : summary.escalatedNeeds > 0 || summary.openSpots > 0
      ? Math.min(2, phases.length - 1)
      : phases.length - 1;

  return phases.map((phase, index) => ({
    id: `${incident.id}-phase-${index}`,
    label: phase,
    status: index < activeIndex ? 'complete' : index === activeIndex ? 'active' : 'upcoming'
  }));
}

function buildOrganizationBreakdown({ incidentNeeds, incidentAssignments, incidentRequests, lowInventory }) {
  const rows = {};

  incidentNeeds.forEach((need) => {
    const key = String(need.organizationId || 'unknown');
    if (!rows[key]) {
      rows[key] = {
        organizationId: need.organizationId || 'unknown',
        organizationName: need.organizationName || 'Unknown organization',
        organizationShortName: need.organizationShortName || 'ORG',
        liveNeeds: 0,
        openSpots: 0,
        activeAssignments: 0,
        escalations: 0,
        lowInventory: 0,
        mutualAid: 0
      };
    }
    rows[key].liveNeeds += 1;
    rows[key].openSpots += Number(need.openSpots || 0);
    rows[key].escalations += ['escalated', 'acknowledged'].includes(need.escalation?.status) ? 1 : 0;
  });

  incidentAssignments.forEach((assignment) => {
    const key = String(assignment.organizationId || 'unknown');
    if (!rows[key]) {
      rows[key] = {
        organizationId: assignment.organizationId || 'unknown',
        organizationName: assignment.organizationName || 'Unknown organization',
        organizationShortName: assignment.organizationShortName || 'ORG',
        liveNeeds: 0,
        openSpots: 0,
        activeAssignments: 0,
        escalations: 0,
        lowInventory: 0,
        mutualAid: 0
      };
    }
    if (assignment.status !== 'completed') {
      rows[key].activeAssignments += 1;
    }
  });

  lowInventory.forEach((item) => {
    const key = String(item.organizationId || 'unknown');
    if (rows[key]) {
      rows[key].lowInventory += 1;
    }
  });

  incidentRequests.forEach((request) => {
    [request.requestingOrganizationId, request.supportingOrganizationId].forEach((organizationId) => {
      const key = String(organizationId || 'unknown');
      if (!rows[key]) {
        return;
      }
      rows[key].mutualAid += 1;
    });
  });

  return Object.values(rows).sort((left, right) =>
    right.escalations - left.escalations
    || right.openSpots - left.openSpots
    || right.liveNeeds - left.liveNeeds
  );
}

function buildResponseHealth({ incidentNeeds, incidentAssignments, incidentRequests, lowInventory, notifications }) {
  return [
    {
      label: 'Staffing',
      value: Math.max(0, 100 - incidentNeeds.reduce((sum, need) => sum + Number(need.openSpots || 0), 0) * 6),
      detail: 'Volunteer coverage resilience'
    },
    {
      label: 'Supplies',
      value: Math.max(0, 100 - lowInventory.length * 14),
      detail: 'Inventory continuity'
    },
    {
      label: 'Coordination',
      value: Math.max(0, 100 - incidentRequests.filter((request) => ['requested', 'approved_support'].includes(request.status)).length * 12),
      detail: 'Cross-organization throughput'
    },
    {
      label: 'Signal',
      value: Math.max(0, 100 - notifications.filter((notification) => !notification.read).length * 5),
      detail: 'Alert noise and review load'
    }
  ];
}

function buildIncidentTimeline({ incident, needIds, networkRequests, auditLogs, dispatchLogs, escalations }) {
  const networkRequestIds = new Set(networkRequests.map((request) => String(request.id)));
  const needIdSet = new Set(needIds.map((id) => String(id)));

  const auditEntries = auditLogs
    .filter((log) =>
      String(log.incidentId || '') === String(incident.id)
      || String(log.entityId || '') === String(incident.id)
      || needIdSet.has(String(log.entityId || ''))
      || networkRequestIds.has(String(log.entityId || ''))
    )
    .map((log) => ({
      id: `timeline-audit-${log.id}`,
      type: 'audit',
      title: log.summary,
      detail: `${String(log.action || '').replaceAll('_', ' ')} • ${log.actor?.role || 'system'}`,
      severity: log.severity || 'info',
      createdAt: log.createdAt
    }));

  const dispatchEntries = dispatchLogs
    .filter((log) => String(log.incidentId || '') === String(incident.id))
    .map((log) => ({
      id: `timeline-dispatch-${log.id}`,
      type: 'dispatch',
      title: log.summary,
      detail: `${log.channel || 'dispatch'} -> ${log.target || 'operations'}`,
      severity: log.status === 'failed' ? 'warning' : 'info',
      createdAt: log.createdAt
    }));

  const escalationEntries = escalations
    .filter((need) => need.escalation?.lastEscalatedAt)
    .map((need) => ({
      id: `timeline-escalation-${need.id}`,
      type: 'escalation',
      title: `${need.title} entered the escalation queue`,
      detail: need.escalation?.trigger || `${need.location} requires intervention.`,
      severity: need.escalation?.level === 'critical' ? 'high' : 'medium',
      createdAt: need.escalation?.lastEscalatedAt
    }));

  const networkEntries = networkRequests.flatMap((request) =>
    (Array.isArray(request.history) ? request.history : []).map((entry) => ({
      id: `timeline-network-${request.id}-${entry.id}`,
      type: 'network',
      title: request.summary,
      detail: entry.note || `Mutual-aid request moved to ${entry.status}.`,
      severity: request.priority === 'critical' ? 'high' : 'info',
      createdAt: entry.createdAt || request.updatedAt || request.createdAt
    }))
  );

  return sortByMostRecent(
    [
      ...auditEntries,
      ...dispatchEntries,
      ...escalationEntries,
      ...networkEntries
    ],
    (item) => item.createdAt
  ).slice(0, 14);
}

async function applyInventoryTransferEffects(request, actor) {
  if (request.type !== 'inventory_support' || request.execution?.effectsAppliedAt) {
    return request;
  }

  const inventory = await getInventory();
  const quantity = Number(request.transfer?.quantity || request.suggestedUnits || 0);
  if (!quantity) {
    return request;
  }

  const sourceItem = inventory.find((item) =>
    (request.recommendedInventoryItemIds || []).includes(item.id)
      || (
        String(item.organizationId) === String(request.supportingOrganizationId)
        && String(item.linkedNeedCategory || item.category) === String(request.resourceCategory)
      )
  );

  if (!sourceItem) {
    return request;
  }

  const transferableQuantity = Math.min(quantity, Math.max(Number(sourceItem.quantity || 0), 0));
  if (transferableQuantity <= 0) {
    return request;
  }

  const destinationItem = inventory.find((item) =>
    String(item.id) === String(request.relatedInventoryItemId)
      || (
        String(item.organizationId) === String(request.requestingOrganizationId)
        && String(item.linkedNeedCategory || item.category) === String(sourceItem.linkedNeedCategory || sourceItem.category)
      )
  );

  const updatedSource = {
    ...sourceItem,
    quantity: Number(sourceItem.quantity || 0) - transferableQuantity,
    status: Number(sourceItem.quantity || 0) - transferableQuantity <= Number(sourceItem.threshold || 0) ? 'low' : 'healthy',
    updatedAt: new Date().toISOString()
  };
  await setDocument('inventory', updatedSource.id, updatedSource);

  let targetTransferId = destinationItem?.id || `inv-transfer-${Date.now()}`;
  const updatedDestination = destinationItem
    ? {
      ...destinationItem,
      quantity: Number(destinationItem.quantity || 0) + transferableQuantity,
      status: Number(destinationItem.quantity || 0) + transferableQuantity <= Number(destinationItem.threshold || 0) ? 'low' : 'healthy',
      updatedAt: new Date().toISOString()
    }
    : {
      id: targetTransferId,
      name: sourceItem.name,
      category: sourceItem.category,
      unit: sourceItem.unit || request.transfer?.unit || 'units',
      location: request.transfer?.handoffLocation || request.requestingOrganizationName,
      quantity: transferableQuantity,
      threshold: Number(sourceItem.threshold || 0),
      status: transferableQuantity <= Number(sourceItem.threshold || 0) ? 'low' : 'healthy',
      linkedNeedCategory: sourceItem.linkedNeedCategory || sourceItem.category,
      organizationId: request.requestingOrganizationId,
      organizationName: request.requestingOrganizationName,
      organizationShortName: request.requestingOrganizationShortName,
      notes: `Received via mutual aid from ${request.supportingOrganizationShortName}.`,
      createdBy: actor?.uid || 'system',
      updatedAt: new Date().toISOString()
    };
  await setDocument('inventory', targetTransferId, updatedDestination);

  return {
    ...request,
    execution: {
      ...(request.execution || {}),
      inventoryTransfersApplied: [
        {
          sourceInventoryId: updatedSource.id,
          destinationInventoryId: targetTransferId,
          quantity: transferableQuantity,
          appliedAt: new Date().toISOString()
        }
      ],
      ...(request.execution?.volunteerAssignmentsCreated ? { volunteerAssignmentsCreated: request.execution.volunteerAssignmentsCreated } : {})
    }
  };
}

async function applyVolunteerTransferEffects(request) {
  if (request.type !== 'volunteer_support' || request.execution?.effectsAppliedAt) {
    return request;
  }

  const need = request.relatedNeedId ? await getDocument('needs', request.relatedNeedId) : null;
  if (!need) {
    return request;
  }

  const [volunteers, assignments] = await Promise.all([getVolunteers(), getAssignments()]);
  const existingVolunteerIds = new Set(
    assignments
      .filter((assignment) => String(assignment.needId) === String(need.id) && assignment.status !== 'completed')
      .map((assignment) => String(assignment.volunteerId))
  );

  const quantity = Number(request.transfer?.quantity || request.suggestedUnits || 1);
  const selectedVolunteers = volunteers
    .filter((volunteer) => (request.recommendedVolunteerIds || []).includes(volunteer.id))
    .filter((volunteer) => !existingVolunteerIds.has(String(volunteer.id)))
    .slice(0, quantity);

  const createdAssignmentIds = [];
  await Promise.all(selectedVolunteers.map(async (volunteer, index) => {
    const assignmentId = `a-network-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;
    createdAssignmentIds.push(assignmentId);
    await setDocument('assignments', assignmentId, {
      id: assignmentId,
      needId: String(need.id),
      volunteerId: String(volunteer.id),
      organizationId: need.organizationId,
      organizationName: need.organizationName,
      organizationShortName: need.organizationShortName,
      sourceOrganizationId: volunteer.organizationId,
      sourceOrganizationName: volunteer.organizationName,
      sourceOrganizationShortName: volunteer.organizationShortName,
      hostOrganizationId: need.organizationId,
      hostOrganizationName: need.organizationName,
      hostOrganizationShortName: need.organizationShortName,
      sharedDeployment: true,
      networkRequestId: request.id,
      status: 'accepted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }));

  return {
    ...request,
    execution: {
      ...(request.execution || {}),
      volunteerAssignmentsCreated: createdAssignmentIds,
      ...(request.execution?.inventoryTransfersApplied ? { inventoryTransfersApplied: request.execution.inventoryTransfersApplied } : {})
    }
  };
}

function buildOrganizationSummaries({ organizations, needs, volunteers, assignments, inventory, networkRequests }) {
  return organizations.map((organization) => {
    const orgNeeds = needs.filter((need) => String(need.organizationId) === String(organization.id));
    const orgVolunteers = volunteers.filter((volunteer) => String(volunteer.organizationId) === String(organization.id));
    const orgAssignments = assignments.filter((assignment) => String(assignment.organizationId) === String(organization.id));
    const orgInventory = inventory.filter((item) => String(item.organizationId) === String(organization.id));
    const orgNetworkRequests = networkRequests.filter((request) =>
      String(request.requestingOrganizationId) === String(organization.id)
      || String(request.supportingOrganizationId) === String(organization.id)
    );

    return {
      ...organization,
      needCount: orgNeeds.length,
      volunteerCount: orgVolunteers.length,
      assignmentCount: orgAssignments.length,
      criticalNeedCount: orgNeeds.filter((need) => need.urgency === 'Critical').length,
      openSpots: orgNeeds.reduce((sum, need) => sum + Number(need.openSpots || 0), 0),
      lowInventoryCount: orgInventory.filter((item) => item.status === 'low').length,
      reliabilityAverage: orgVolunteers.length
        ? Math.round(orgVolunteers.reduce((sum, volunteer) => sum + Number(volunteer.reliabilityScore || 0), 0) / orgVolunteers.length)
        : 0,
      activeNetworkRequests: orgNetworkRequests.filter((request) => ['open', 'committed'].includes(request.status)).length
    };
  });
}

function buildMutualAidOpportunities({ needs, volunteers, inventory, networkRequests, orgId = null }) {
  const opportunities = [];
  const activeRequests = networkRequests.filter((request) => ['open', 'committed'].includes(request.status));

  needs
    .filter((need) => Number(need.openSpots || 0) > 0)
    .forEach((need) => {
      const matchingVolunteers = volunteers.filter((volunteer) => {
        const differentOrganization = String(volunteer.organizationId) !== String(need.organizationId);
        const matchingSkill = !need.category || String(volunteer.skill) === String(need.category);
        const matchingBadge = !need.requiredBadge || (volunteer.certifications || []).includes(need.requiredBadge);
        return differentOrganization && matchingSkill && matchingBadge;
      });

      const donorsByOrganization = Array.from(
        matchingVolunteers.reduce((map, volunteer) => {
          const key = String(volunteer.organizationId);
          if (!map.has(key)) {
            map.set(key, []);
          }
          map.get(key).push(volunteer);
          return map;
        }, new Map()).entries()
      ).sort((left, right) => right[1].length - left[1].length);

      const [supportingOrganizationId, donorVolunteers] = donorsByOrganization[0] || [];
      if (!supportingOrganizationId || !donorVolunteers?.length) {
        return;
      }

      const duplicate = activeRequests.some((request) =>
        request.type === 'volunteer_support'
        && String(request.relatedNeedId) === String(need.id)
        && String(request.requestingOrganizationId) === String(need.organizationId)
        && String(request.supportingOrganizationId) === String(supportingOrganizationId)
      );

      if (duplicate) {
        return;
      }

      if (orgId && String(need.organizationId) !== String(orgId) && String(supportingOrganizationId) !== String(orgId)) {
        return;
      }

      const topCandidates = donorVolunteers.slice(0, 3);
      opportunities.push({
        id: `volunteer-${need.id}-${supportingOrganizationId}`,
        type: 'volunteer_support',
        priority: rankPriorityLabel(Number(need.escalation?.score || 0)),
        summary: `${need.organizationShortName || need.organizationName} can receive volunteer support for ${need.title}.`,
        detail: `${topCandidates.length} qualified responder${topCandidates.length === 1 ? '' : 's'} from ${topCandidates[0]?.organizationShortName || 'partner organization'} match ${need.category}${need.requiredBadge ? ` and hold ${need.requiredBadge}` : ''}.`,
        requestingOrganizationId: need.organizationId,
        requestingOrganizationName: need.organizationName,
        requestingOrganizationShortName: need.organizationShortName,
        supportingOrganizationId,
        supportingOrganizationName: topCandidates[0]?.organizationName,
        supportingOrganizationShortName: topCandidates[0]?.organizationShortName,
        relatedNeedId: need.id,
        resourceCategory: need.category,
        suggestedUnits: Number(need.openSpots || 0),
        candidateCount: donorVolunteers.length,
        recommendedVolunteerIds: topCandidates.map((volunteer) => volunteer.id),
        recommendedVolunteerNames: topCandidates.map((volunteer) => volunteer.name),
        needTitle: need.title,
        location: need.location
      });
    });

  inventory
    .filter((item) => item.status === 'low')
    .forEach((item) => {
      const donorItems = inventory.filter((candidate) => {
        const differentOrganization = String(candidate.organizationId) !== String(item.organizationId);
        const matchingCategory = String(candidate.linkedNeedCategory || candidate.category) === String(item.linkedNeedCategory || item.category);
        const surplus = Number(candidate.quantity || 0) - Number(candidate.threshold || 0);
        return differentOrganization && matchingCategory && surplus > 0;
      });

      const bestDonor = donorItems
        .map((candidate) => ({
          ...candidate,
          surplusUnits: Number(candidate.quantity || 0) - Number(candidate.threshold || 0)
        }))
        .sort((left, right) => right.surplusUnits - left.surplusUnits)[0];

      if (!bestDonor) {
        return;
      }

      const duplicate = activeRequests.some((request) =>
        request.type === 'inventory_support'
        && String(request.relatedInventoryItemId) === String(item.id)
        && String(request.requestingOrganizationId) === String(item.organizationId)
        && String(request.supportingOrganizationId) === String(bestDonor.organizationId)
      );

      if (duplicate) {
        return;
      }

      if (orgId && String(item.organizationId) !== String(orgId) && String(bestDonor.organizationId) !== String(orgId)) {
        return;
      }

      opportunities.push({
        id: `inventory-${item.id}-${bestDonor.organizationId}`,
        type: 'inventory_support',
        priority: 'high',
        summary: `${item.organizationShortName || item.organizationName} can be restocked from ${bestDonor.organizationShortName || bestDonor.organizationName}.`,
        detail: `${bestDonor.organizationShortName || bestDonor.organizationName} has ${bestDonor.surplusUnits} surplus ${bestDonor.unit || 'units'} of ${bestDonor.name}.`,
        requestingOrganizationId: item.organizationId,
        requestingOrganizationName: item.organizationName,
        requestingOrganizationShortName: item.organizationShortName,
        supportingOrganizationId: bestDonor.organizationId,
        supportingOrganizationName: bestDonor.organizationName,
        supportingOrganizationShortName: bestDonor.organizationShortName,
        relatedInventoryItemId: item.id,
        resourceCategory: item.category,
        suggestedUnits: Math.min(bestDonor.surplusUnits, Math.max(Number(item.threshold || 0) - Number(item.quantity || 0), 1)),
        candidateCount: 1,
        recommendedInventoryItemIds: [bestDonor.id],
        inventoryName: item.name,
        location: item.location
      });
    });

  return opportunities
    .sort((left, right) => {
      const priorityOrder = { critical: 4, high: 3, watch: 2, normal: 1 };
      const priorityGap = (priorityOrder[right.priority] || 0) - (priorityOrder[left.priority] || 0);
      if (priorityGap !== 0) {
        return priorityGap;
      }
      return Number(right.suggestedUnits || 0) - Number(left.suggestedUnits || 0);
    })
    .slice(0, 8);
}

function sortMarketplaceListings(listings = []) {
  const priorityOrder = { critical: 4, high: 3, watch: 2, normal: 1 };
  return listings
    .slice()
    .sort((left, right) => {
      const priorityGap = (priorityOrder[right.priority] || 0) - (priorityOrder[left.priority] || 0);
      if (priorityGap !== 0) {
        return priorityGap;
      }

      return String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''));
    });
}

function buildMarketplaceOverview({ organizations, volunteers, assignments, inventory, networkRequests, marketplaceListings, orgId = null }) {
  const activeAssignmentVolunteerIds = new Set(
    assignments
      .filter((assignment) => assignment.status !== 'completed')
      .map((assignment) => String(assignment.volunteerId))
  );
  const activeExchangeCount = networkRequests.filter((request) => ['requested', 'approved_support', 'in_transit', 'delivered', 'verified'].includes(normalizeNetworkStatus(request.status))).length;
  const filteredManualListings = marketplaceListings.filter((listing) => {
    if (listing.status !== 'open') {
      return false;
    }

    if (!orgId) {
      return true;
    }

    return String(listing.organizationId) === String(orgId) || String(listing.targetOrganizationId || '') === String(orgId);
  });

  const autoInventoryOffers = inventory
    .filter((item) => Number(item.quantity || 0) > Number(item.threshold || 0))
    .filter((item) => !orgId || String(item.organizationId) === String(orgId))
    .map((item) => ({
      id: `auto-offer-inventory-${item.id}`,
      listingType: 'offer',
      resourceType: 'inventory',
      status: 'open',
      source: 'inventory_auto',
      title: `${item.organizationShortName} can share ${item.name}`,
      detail: `${item.organizationShortName} has ${Number(item.quantity || 0) - Number(item.threshold || 0)} surplus ${item.unit || 'units'} available for partner transfer.`,
      priority: Number(item.quantity || 0) - Number(item.threshold || 0) > 20 ? 'high' : 'watch',
      resourceCategory: item.linkedNeedCategory || item.category,
      quantity: Number(item.quantity || 0) - Number(item.threshold || 0),
      unit: item.unit || 'units',
      location: item.location,
      organizationId: item.organizationId,
      organizationName: item.organizationName,
      organizationShortName: item.organizationShortName,
      inventoryItemId: item.id,
      volunteerIds: [],
      certificationHints: [],
      targetOrganizationId: null,
      metadata: {
        inventoryName: item.name,
        threshold: item.threshold
      },
      createdAt: item.updatedAt,
      updatedAt: item.updatedAt
    }));

  const volunteerOffersByKey = volunteers
    .filter((volunteer) => !activeAssignmentVolunteerIds.has(String(volunteer.id)))
    .filter((volunteer) => !orgId || String(volunteer.organizationId) === String(orgId))
    .reduce((map, volunteer) => {
      const key = `${volunteer.organizationId}-${volunteer.skill}`;
      if (!map.has(key)) {
        map.set(key, {
          id: `auto-offer-volunteer-${volunteer.organizationId}-${String(volunteer.skill || 'general').toLowerCase()}`,
          listingType: 'offer',
          resourceType: 'volunteer',
          status: 'open',
          source: 'volunteer_auto',
          title: `${volunteer.organizationShortName} can deploy ${volunteer.skill} responders`,
          detail: '',
          priority: 'watch',
          resourceCategory: volunteer.skill || 'General',
          quantity: 0,
          unit: 'volunteers',
          location: volunteer.location || 'Field team',
          organizationId: volunteer.organizationId,
          organizationName: volunteer.organizationName,
          organizationShortName: volunteer.organizationShortName,
          volunteerIds: [],
          certificationHints: [],
          targetOrganizationId: null,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }

      const entry = map.get(key);
      entry.quantity += 1;
      entry.volunteerIds.push(volunteer.id);
      entry.certificationHints = Array.from(new Set([
        ...entry.certificationHints,
        ...(volunteer.certifications || [])
      ])).slice(0, 5);
      entry.detail = `${entry.quantity} available responder${entry.quantity === 1 ? '' : 's'} from ${entry.organizationShortName} can support ${entry.resourceCategory.toLowerCase()} operations.`;
      entry.priority = entry.quantity >= 3 ? 'high' : 'watch';
      entry.updatedAt = new Date().toISOString();
      return map;
    }, new Map());

  const listings = sortMarketplaceListings([
    ...filteredManualListings,
    ...autoInventoryOffers,
    ...Array.from(volunteerOffersByKey.values())
  ]);

  const organizationStats = organizations.map((organization) => {
    const openListings = listings.filter((listing) => String(listing.organizationId) === String(organization.id));
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationShortName: organization.shortName,
      openListings: openListings.length,
      offers: openListings.filter((listing) => listing.listingType === 'offer').length,
      requests: openListings.filter((listing) => listing.listingType === 'request').length
    };
  });

  return {
    summary: {
      openOffers: listings.filter((listing) => listing.listingType === 'offer').length,
      openRequests: listings.filter((listing) => listing.listingType === 'request').length,
      activeExchanges: activeExchangeCount,
      automatedOffers: listings.filter((listing) => listing.source !== 'manual').length
    },
    listings: listings.slice(0, 12),
    organizations: organizationStats
  };
}

async function scanNeedFromImage(req, res) {
  try {
    const { imageData, mimeType, fileName } = req.body;
    const base64Data = String(imageData || '').split(',').pop();
    const extractedFields = await extractNeedFromImage({ mimeType, base64Data, fileName });
    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        source: 'ocr'
      },
      action: 'ocr_scan_succeeded',
      entityType: 'ocr_scan',
      entityId: fileName || 'uploaded-image',
      summary: `OCR scan succeeded for ${fileName || 'uploaded image'}.`,
      metadata: {
        fileName: fileName || '',
        extractedFields: Object.keys(extractedFields || {})
      },
      severity: 'info'
    });
    res.json({ success: true, extractedFields });
  } catch (error) {
    console.error('OCR endpoint error:', error);
    await createNotification(
      'ocr_failure',
      'OCR scan needs review',
      `The intake scan for ${req.body.fileName || 'an uploaded image'} failed and requires manual entry.`
    );
    await logAuditEvent({
      actor: {
        uid: req.user?.uid || 'system',
        email: req.user?.email || '',
        role: req.user?.role || 'system',
        source: 'ocr'
      },
      action: 'ocr_scan_failed',
      entityType: 'ocr_scan',
      entityId: req.body.fileName || 'uploaded-image',
      summary: `OCR scan failed for ${req.body.fileName || 'an uploaded image'}.`,
      metadata: {
        fileName: req.body.fileName || '',
        reason: error.message
      },
      severity: 'warning'
    });
    res.status(500).json({ success: false, error: 'Failed to scan intake form', details: error.message });
  }
}

async function listAuditTrail(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const action = req.query.action ? String(req.query.action) : null;
  const entityType = req.query.entityType ? String(req.query.entityType) : null;
  const severity = req.query.severity ? String(req.query.severity) : null;

  const logs = (await getAuditLogs())
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .filter((log) => !action || log.action === action)
    .filter((log) => !entityType || log.entityType === entityType)
    .filter((log) => !severity || log.severity === severity)
    .slice(0, limit);

  res.json(logs);
}

async function getMatches(req, res) {
  try {
    const requestedNeedId = req.query.needId ? String(req.query.needId) : null;
    const orgId = req.query.orgId && req.query.orgId !== 'all' ? String(req.query.orgId) : null;
    const [needs, volunteers] = await Promise.all([getNeeds(), getVolunteers()]);
    const scopedNeeds = orgId ? needs.filter((need) => String(need.organizationId) === orgId) : needs;
    const scopedVolunteers = orgId ? volunteers.filter((volunteer) => String(volunteer.organizationId) === orgId) : volunteers;
    const needsToEvaluate = requestedNeedId
      ? scopedNeeds.filter((need) => String(need.id) === requestedNeedId)
      : scopedNeeds;

    if (requestedNeedId && needsToEvaluate.length === 0) {
      return res.status(404).json({ success: false, error: 'Need not found' });
    }

    const aiInsight = await getSmartMatches(needsToEvaluate, scopedVolunteers);
    const recommendations = buildVolunteerRecommendations(needsToEvaluate, scopedVolunteers);

    res.json({
      success: true,
      aiInsight,
      needId: requestedNeedId,
      recommendations
    });
  } catch (error) {
    console.error('Match calculation error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate matches', details: error.message });
  }
}

async function listOrganizations(req, res) {
  try {
    const user = await resolveOptionalUser(req);
    const [organizations, needs, volunteers, assignments, users, profile] = await Promise.all([
      getOrganizations(),
      getNeeds(),
      getVolunteers(),
      getAssignments(),
      listCollection('users'),
      user?.uid ? getUserProfile(user.uid) : Promise.resolve(null)
    ]);
    const memberships = new Set(Array.isArray(profile?.communityMemberships) ? profile.communityMemberships : []);

    const rows = organizations.map((organization) => ({
      ...organization,
      needCount: needs.filter((need) => String(need.organizationId) === String(organization.id)).length,
      volunteerCount: volunteers.filter((volunteer) => String(volunteer.organizationId) === String(organization.id)).length,
      assignmentCount: assignments.filter((assignment) => String(assignment.organizationId) === String(organization.id)).length,
      memberCount: users.filter((entry) => Array.isArray(entry.communityMemberships) && entry.communityMemberships.includes(organization.id)).length,
      isMember: memberships.has(organization.id)
    }));

    res.json(rows);
  } catch (error) {
    console.error('Organizations route error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch organizations' });
  }
}

async function joinCommunity(req, res) {
  try {
    const communityId = String(req.params.id || '');
    const organizations = await getOrganizations();
    const community = organizations.find((organization) => String(organization.id) === communityId);

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found' });
    }

    const existingProfile = await getUserProfile(req.user.uid);
    const nextMemberships = Array.from(new Set([
      ...(Array.isArray(existingProfile?.communityMemberships) ? existingProfile.communityMemberships : []),
      communityId
    ]));

    const profile = await setUserProfile(req.user.uid, {
      email: req.user.email || existingProfile?.email || '',
      role: req.user.role || existingProfile?.role || 'viewer',
      displayName: existingProfile?.displayName || '',
      createdAt: existingProfile?.createdAt,
      communityMemberships: nextMemberships,
      training: existingProfile?.training
    });

    await createNotification(
      'community_membership',
      `${community.shortName} joined your network workspace`,
      `${req.user.email || 'A user'} joined ${community.name} to monitor live collaboration opportunities.`
    );
    await logAuditEvent({
      actor: cloneActor(req.user, 'network-community'),
      action: 'community_joined',
      entityType: 'organization',
      entityId: community.id,
      summary: `${req.user.email || 'User'} joined ${community.name}`,
      metadata: {
        communityId: community.id,
        membershipCount: nextMemberships.length
      },
      severity: 'info'
    });

    return res.status(200).json({ success: true, community, profile });
  } catch (error) {
    console.error('Join community error:', error);
    return res.status(500).json({ success: false, error: 'Failed to join community' });
  }
}

async function leaveCommunity(req, res) {
  try {
    const communityId = String(req.params.id || '');
    const organizations = await getOrganizations();
    const community = organizations.find((organization) => String(organization.id) === communityId);

    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found' });
    }

    const existingProfile = await getUserProfile(req.user.uid);
    const nextMemberships = (Array.isArray(existingProfile?.communityMemberships) ? existingProfile.communityMemberships : [])
      .filter((membershipId) => String(membershipId) !== communityId);

    const profile = await setUserProfile(req.user.uid, {
      email: req.user.email || existingProfile?.email || '',
      role: req.user.role || existingProfile?.role || 'viewer',
      displayName: existingProfile?.displayName || '',
      createdAt: existingProfile?.createdAt,
      communityMemberships: nextMemberships,
      training: existingProfile?.training
    });

    await createNotification(
      'community_membership',
      `${community.shortName} removed from your workspace`,
      `${req.user.email || 'A user'} left ${community.name}. Network-wide monitoring remains available.`
    );
    await logAuditEvent({
      actor: cloneActor(req.user, 'network-community'),
      action: 'community_left',
      entityType: 'organization',
      entityId: community.id,
      summary: `${req.user.email || 'User'} left ${community.name}`,
      metadata: {
        communityId: community.id,
        membershipCount: nextMemberships.length
      },
      severity: 'info'
    });

    return res.status(200).json({ success: true, community, profile });
  } catch (error) {
    console.error('Leave community error:', error);
    return res.status(500).json({ success: false, error: 'Failed to leave community' });
  }
}

async function listIncidents(req, res) {
  try {
    const [incidents, needs, assignments, volunteers, inventory] = await Promise.all([
      listCollection('incidents'),
      getNeeds(),
      getAssignments(),
      getVolunteers(),
      getInventory()
    ]);
    const hydratedNeeds = await Promise.all(needs.map((need) => hydrateNeed(need, assignments, volunteers, inventory)));

    const rows = sortByMostRecent(incidents, (incident) => incident.updatedAt || incident.startedAt).map((incident) => {
      const incidentNeeds = hydratedNeeds.filter((need) => String(need.incidentId) === String(incident.id));
      const openSpots = incidentNeeds.reduce((sum, need) => sum + Number(need.openSpots || 0), 0);
      return {
        ...incident,
        liveNeeds: incidentNeeds.length,
        escalatedNeeds: incidentNeeds.filter((need) => ['escalated', 'acknowledged'].includes(need.escalation?.status)).length,
        openSpots,
        lowInventoryCount: inventory.filter((item) => String(item.incidentId) === String(incident.id) && Number(item.quantity || 0) <= Number(item.threshold || 0)).length
      };
    });

    return res.json({ success: true, incidents: rows });
  } catch (error) {
    console.error('Incident list error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch incidents' });
  }
}

async function getIncidentCommandOverview(req, res) {
  try {
    const incidentId = String(req.params.id || '');
    const [incidents, needs, volunteers, assignments, inventory, networkRequests, auditLogs, dispatchLogs, notifications] = await Promise.all([
      listCollection('incidents'),
      getNeeds(),
      getVolunteers(),
      getAssignments(),
      getInventory(),
      getNetworkRequests(),
      getAuditLogs(),
      getDispatchLogs(),
      getNotifications()
    ]);

    const incident = incidents.find((item) => String(item.id) === incidentId);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident not found' });
    }

    const hydratedNeeds = await Promise.all(needs.map((need) => hydrateNeed(need, assignments, volunteers, inventory)));
    const incidentNeeds = sortByMostRecent(
      hydratedNeeds.filter((need) => String(need.incidentId) === incidentId),
      (need) => need.createdAt
    );
    const incidentNeedIds = incidentNeeds.map((need) => need.id);
    const incidentAssignments = sortByMostRecent(
      assignments
        .filter((assignment) => incidentNeedIds.includes(String(assignment.needId)))
        .map((assignment) => {
          const matchedNeed = incidentNeeds.find((need) => String(need.id) === String(assignment.needId));
          const volunteer = volunteers.find((item) => String(item.id) === String(assignment.volunteerId));
          return {
            ...assignment,
            needTitle: matchedNeed?.title || 'Unknown need',
            volunteerName: volunteer?.name || 'Unknown volunteer',
            volunteerSkill: volunteer?.skill || 'General'
          };
        }),
      (assignment) => assignment.updatedAt || assignment.createdAt
    );
    const incidentInventory = sortByMostRecent(
      inventory.filter((item) => String(item.incidentId) === incidentId || incidentNeedIds.some((needId) => String(item.relatedNeedId || '') === String(needId))),
      (item) => item.updatedAt
    );
    const incidentRequests = sortByMostRecent(
      networkRequests
        .filter((request) => String(request.incidentId) === incidentId || incidentNeedIds.includes(String(request.relatedNeedId || '')))
        .map((request) => ({
          ...request,
          status: normalizeNetworkStatus(request.status)
        })),
      (request) => request.updatedAt || request.createdAt
    );
    const incidentEscalations = incidentNeeds
      .filter((need) => ['escalated', 'acknowledged'].includes(need.escalation?.status))
      .sort((left, right) => Number(right.escalation?.score || 0) - Number(left.escalation?.score || 0));
    const incidentNotifications = sortByMostRecent(
      notifications.filter((notification) =>
        String(notification.incidentId || '') === incidentId
        || incidentNeedIds.includes(String(notification.entityId || ''))
      ),
      (notification) => notification.createdAt
    ).slice(0, 8);

    const lowInventory = incidentInventory.filter((item) => Number(item.quantity || 0) <= Number(item.threshold || 0));
    const activeAssignments = incidentAssignments.filter((assignment) => assignment.status !== 'completed');
    const openSpots = incidentNeeds.reduce((sum, need) => sum + Number(need.openSpots || 0), 0);
    const coverageCapacity = incidentNeeds.reduce((sum, need) => sum + Number(need.volunteersNeeded || 0), 0);
    const categoryMix = Object.entries(
      incidentNeeds.reduce((accumulator, need) => {
        accumulator[need.category] = (accumulator[need.category] || 0) + 1;
        return accumulator;
      }, {})
    ).map(([label, value]) => ({ label, value }));
    const zoneSummary = Object.values(incidentNeeds.reduce((accumulator, need) => {
      const zoneKey = need.location || incident.zone || 'Unknown';
      if (!accumulator[zoneKey]) {
        accumulator[zoneKey] = {
          zone: zoneKey,
          liveNeeds: 0,
          criticalNeeds: 0,
          openSpots: 0,
          lowInventory: 0
        };
      }
      accumulator[zoneKey].liveNeeds += 1;
      accumulator[zoneKey].criticalNeeds += need.urgency === 'Critical' ? 1 : 0;
      accumulator[zoneKey].openSpots += Number(need.openSpots || 0);
      accumulator[zoneKey].lowInventory += lowInventory.filter((item) => String(item.location || '').includes(zoneKey)).length;
      return accumulator;
    }, {})).sort((left, right) => right.criticalNeeds - left.criticalNeeds || right.openSpots - left.openSpots);

    const summary = {
      liveNeeds: incidentNeeds.length,
      criticalNeeds: incidentNeeds.filter((need) => need.urgency === 'Critical').length,
      escalatedNeeds: incidentEscalations.length,
      openSpots,
      activeAssignments: activeAssignments.length,
      coverageRate: coverageCapacity ? Math.round(((coverageCapacity - openSpots) / coverageCapacity) * 100) : 100,
      lowInventoryCount: lowInventory.length,
      activeMutualAidRequests: incidentRequests.filter((request) => ['requested', 'approved_support', 'in_transit', 'delivered', 'verified'].includes(request.status)).length,
      affectedPopulation: Number(incident.affectedPopulation || 0)
    };
    const readiness = buildIncidentReadiness({
      summary,
      escalations: incidentEscalations,
      lowInventoryCount: lowInventory.length,
      activeRequests: summary.activeMutualAidRequests
    });
    const recommendations = buildIncidentRecommendations({
      incident,
      needs: incidentNeeds,
      escalations: incidentEscalations,
      openSpots,
      lowInventory,
      networkRequests: incidentRequests,
      assignments: incidentAssignments
    });
    const phaseTracker = buildIncidentPhaseStatus(incident, { summary, readiness });
    const organizationBreakdown = buildOrganizationBreakdown({
      incidentNeeds,
      incidentAssignments,
      incidentRequests,
      lowInventory
    });
    const responseHealth = buildResponseHealth({
      incidentNeeds,
      incidentAssignments,
      incidentRequests,
      lowInventory,
      notifications: incidentNotifications
    });

    return res.json({
      success: true,
      incident,
      summary,
      readiness,
      leadershipBrief: buildIncidentLeadershipBrief({
        incident,
        needs: incidentNeeds,
        escalations: incidentEscalations,
        assignments: incidentAssignments,
        inventory: incidentInventory,
        networkRequests: incidentRequests
      }),
      categoryMix,
      zones: zoneSummary,
      recommendations,
      phaseTracker,
      organizationBreakdown,
      responseHealth,
      needs: incidentNeeds,
      escalations: incidentEscalations,
      assignments: incidentAssignments,
      inventory: incidentInventory,
      networkRequests: incidentRequests,
      notifications: incidentNotifications,
      timeline: buildIncidentTimeline({
        incident,
        needIds: incidentNeedIds,
        networkRequests: incidentRequests,
        auditLogs,
        dispatchLogs,
        escalations: incidentEscalations
      })
    });
  } catch (error) {
    console.error('Incident command overview error:', error);
    return res.status(500).json({ success: false, error: 'Failed to build incident command overview' });
  }
}

async function getNetworkOverview(req, res) {
  try {
    const orgId = req.query.orgId && req.query.orgId !== 'all' ? String(req.query.orgId) : null;
    const [organizations, needs, volunteers, assignments, inventory, networkRequests, marketplaceListings] = await Promise.all([
      getOrganizations(),
      getNeeds(),
      getVolunteers(),
      getAssignments(),
      getInventory(),
      getNetworkRequests(),
      getMarketplaceListings()
    ]);

    const hydratedNeeds = await Promise.all(needs.map((need) => hydrateNeed(need, assignments, volunteers, inventory)));
    const filteredRequests = networkRequests
      .filter((request) => !orgId
        || String(request.requestingOrganizationId) === String(orgId)
        || String(request.supportingOrganizationId) === String(orgId))
      .map((request) => ({
        ...request,
        status: normalizeNetworkStatus(request.status)
      }))
      .slice()
      .sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)));

    const scopedOrganizations = orgId
      ? organizations.filter((organization) => String(organization.id) === String(orgId))
      : organizations;
    const scopedNeeds = orgId
      ? hydratedNeeds.filter((need) => String(need.organizationId) === String(orgId))
      : hydratedNeeds;
    const scopedVolunteers = orgId
      ? volunteers.filter((volunteer) => String(volunteer.organizationId) === String(orgId))
      : volunteers;
    const scopedInventory = orgId
      ? inventory.filter((item) => String(item.organizationId) === String(orgId))
      : inventory;

    const summary = buildNetworkSummary(filteredRequests);

    return res.json({
      success: true,
      summary,
      organizations: buildOrganizationSummaries({
        organizations: scopedOrganizations,
        needs: scopedNeeds,
        volunteers: scopedVolunteers,
        assignments,
        inventory: scopedInventory,
        networkRequests: filteredRequests
      }),
      marketplace: buildMarketplaceOverview({
        organizations,
        volunteers,
        assignments,
        inventory,
        networkRequests,
        marketplaceListings,
        orgId
      }),
      opportunities: buildMutualAidOpportunities({
        needs: hydratedNeeds,
        volunteers,
        inventory,
        networkRequests,
        orgId
      }),
      requests: filteredRequests
    });
  } catch (error) {
    console.error('Network overview error:', error);
    return res.status(500).json({ success: false, error: 'Failed to build network overview' });
  }
}

async function createMarketplaceListing(req, res) {
  try {
    if (!canManageNetworkRequests(req.user)) {
      return res.status(403).json({ success: false, error: 'Only admins and coordinators can publish marketplace listings' });
    }

    const organizations = await getOrganizations();
    const organizationId = String(req.body.organizationId || '');
    const organization = organizations.find((item) => String(item.id) === organizationId);

    if (!organization) {
      return res.status(400).json({ success: false, error: 'A valid organization is required to publish a listing' });
    }

    const listing = buildMarketplaceListing({
      ...req.body,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationShortName: organization.shortName,
      status: 'open',
      source: 'manual'
    }, {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role
    });

    await setDocument('marketplaceListings', listing.id, listing);
    await createNotification(
      'marketplace_listing',
      `${listing.organizationShortName} published a marketplace ${listing.listingType}`,
      `${listing.title} is now visible to the partner network.`
    );
    await createDispatchLog(
      `Marketplace ${listing.listingType} published by ${listing.organizationShortName}`,
      listing.title,
      'queued',
      'network-marketplace'
    );
    await logAuditEvent({
      actor: cloneActor(req.user, 'network-marketplace'),
      action: 'marketplace_listing_created',
      entityType: 'marketplace_listing',
      entityId: listing.id,
      summary: `${listing.organizationShortName} published ${listing.title}.`,
      metadata: {
        listingType: listing.listingType,
        resourceType: listing.resourceType,
        resourceCategory: listing.resourceCategory,
        quantity: listing.quantity
      },
      severity: listing.priority === 'critical' ? 'high' : 'info'
    });

    return res.status(201).json({ success: true, listing });
  } catch (error) {
    console.error('Create marketplace listing error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create marketplace listing' });
  }
}

async function createMarketplaceExchange(req, res) {
  try {
    if (!canManageNetworkRequests(req.user)) {
      return res.status(403).json({ success: false, error: 'Only admins and coordinators can open marketplace exchanges' });
    }

    const listingPayload = req.body.listing || {};
    const counterpartyOrganizationId = String(req.body.counterpartyOrganizationId || '');
    const organizations = await getOrganizations();
    const listingOrganization = organizations.find((item) => String(item.id) === String(listingPayload.organizationId));
    const counterpartyOrganization = organizations.find((item) => String(item.id) === counterpartyOrganizationId);

    if (!listingOrganization || !counterpartyOrganization) {
      return res.status(400).json({ success: false, error: 'Both marketplace organizations must be valid' });
    }

    const isOffer = String(listingPayload.listingType || 'offer') === 'offer';
    if (String(listingOrganization.id) === String(counterpartyOrganization.id)) {
      return res.status(400).json({ success: false, error: 'Choose a different partner organization to open the exchange' });
    }

    const nextRequest = buildNetworkRequest({
      type: String(listingPayload.resourceType || 'inventory') === 'volunteer' ? 'volunteer_support' : 'inventory_support',
      priority: listingPayload.priority || 'watch',
      summary: isOffer
        ? `${counterpartyOrganization.shortName} requested ${listingPayload.title} from ${listingOrganization.shortName}.`
        : `${listingOrganization.shortName} requested ${listingPayload.title} from ${counterpartyOrganization.shortName}.`,
      detail: listingPayload.detail || '',
      resourceCategory: listingPayload.resourceCategory || 'General',
      relatedNeedId: listingPayload.linkedNeedId || null,
      relatedInventoryItemId: listingPayload.inventoryItemId || null,
      requestingOrganizationId: isOffer ? counterpartyOrganization.id : listingOrganization.id,
      requestingOrganizationName: isOffer ? counterpartyOrganization.name : listingOrganization.name,
      requestingOrganizationShortName: isOffer ? counterpartyOrganization.shortName : listingOrganization.shortName,
      supportingOrganizationId: isOffer ? listingOrganization.id : counterpartyOrganization.id,
      supportingOrganizationName: isOffer ? listingOrganization.name : counterpartyOrganization.name,
      supportingOrganizationShortName: isOffer ? listingOrganization.shortName : counterpartyOrganization.shortName,
      suggestedUnits: Number(listingPayload.quantity) || 0,
      candidateCount: Array.isArray(listingPayload.volunteerIds) ? listingPayload.volunteerIds.length : 1,
      recommendedVolunteerIds: Array.isArray(listingPayload.volunteerIds) ? listingPayload.volunteerIds : [],
      recommendedInventoryItemIds: listingPayload.inventoryItemId ? [listingPayload.inventoryItemId] : [],
      transfer: {
        quantity: Number(listingPayload.quantity) || 0,
        unit: listingPayload.unit || 'units',
        handoffLocation: listingPayload.location || '',
        notes: `Opened from marketplace listing ${listingPayload.title || ''}.`
      }
    }, {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role
    });

    await setDocument('networkRequests', nextRequest.id, nextRequest);

    if (listingPayload.id && !String(listingPayload.id).startsWith('auto-offer-')) {
      const currentListing = await getDocument('marketplaceListings', listingPayload.id);
      if (currentListing) {
        await setDocument('marketplaceListings', currentListing.id, {
          ...currentListing,
          status: 'converted',
          linkedNetworkRequestId: nextRequest.id,
          matchedOrganizationId: counterpartyOrganization.id,
          convertedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    await createNotification(
      'marketplace_exchange',
      'Marketplace exchange opened',
      `${nextRequest.requestingOrganizationShortName} and ${nextRequest.supportingOrganizationShortName} now have a live transfer workflow.`
    );
    await createDispatchLog(
      `Marketplace exchange opened: ${nextRequest.requestingOrganizationShortName} -> ${nextRequest.supportingOrganizationShortName}`,
      nextRequest.summary,
      'queued',
      'network-marketplace'
    );
    await logAuditEvent({
      actor: cloneActor(req.user, 'network-marketplace'),
      action: 'marketplace_exchange_opened',
      entityType: 'network_request',
      entityId: nextRequest.id,
      summary: nextRequest.summary,
      metadata: {
        listingId: listingPayload.id || null,
        requestingOrganizationId: nextRequest.requestingOrganizationId,
        supportingOrganizationId: nextRequest.supportingOrganizationId,
        resourceType: listingPayload.resourceType || 'inventory'
      },
      severity: nextRequest.priority === 'critical' ? 'high' : 'info'
    });

    return res.status(201).json({ success: true, request: nextRequest });
  } catch (error) {
    console.error('Create marketplace exchange error:', error);
    return res.status(500).json({ success: false, error: 'Failed to open marketplace exchange' });
  }
}

async function createNetworkRequest(req, res) {
  try {
    if (!canManageNetworkRequests(req.user)) {
      return res.status(403).json({ success: false, error: 'Only admins and coordinators can create network requests' });
    }

    const nextRequest = buildNetworkRequest(req.body, {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role
    });

    await setDocument('networkRequests', nextRequest.id, nextRequest);
    await createNotification(
      'network_request',
      `${nextRequest.requestingOrganizationShortName} requested cross-org support`,
      `${nextRequest.summary} ${nextRequest.supportingOrganizationShortName} is the recommended supporting organization.`
    );
    await createDispatchLog(
      `Mutual aid request opened: ${nextRequest.requestingOrganizationShortName} -> ${nextRequest.supportingOrganizationShortName}`,
      nextRequest.summary,
      'queued',
      'network'
    );
    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        source: 'network-board'
      },
      action: 'network_request_created',
      entityType: 'network_request',
      entityId: nextRequest.id,
      summary: nextRequest.summary,
      metadata: {
        type: nextRequest.type,
        status: nextRequest.status,
        requestingOrganizationId: nextRequest.requestingOrganizationId,
        supportingOrganizationId: nextRequest.supportingOrganizationId,
        suggestedUnits: nextRequest.suggestedUnits
      },
      severity: nextRequest.priority === 'critical' ? 'high' : 'info'
    });

    return res.status(201).json({ success: true, request: nextRequest });
  } catch (error) {
    console.error('Create network request error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create network request' });
  }
}

async function updateNetworkRequestStatus(req, res) {
  try {
    if (!canManageNetworkRequests(req.user)) {
      return res.status(403).json({ success: false, error: 'Only admins and coordinators can update network requests' });
    }

    const currentRequest = await getDocument('networkRequests', req.params.id);
    if (!currentRequest) {
      return res.status(404).json({ success: false, error: 'Network request not found' });
    }

    const action = String(req.body.action || req.body.status || '').toLowerCase();
    const nextStatus = getAllowedTransition(currentRequest.status, action);
    if (!nextStatus) {
      return res.status(400).json({ success: false, error: 'Invalid network request transition' });
    }

    let updatedRequest = {
      ...currentRequest,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      resolvedAt: ['closed', 'cancelled'].includes(nextStatus) ? new Date().toISOString() : null,
      transfer: {
        ...(currentRequest.transfer || {}),
        quantity: Number(req.body.transferQuantity ?? currentRequest.transfer?.quantity ?? currentRequest.suggestedUnits) || 0,
        unit: req.body.transferUnit ?? currentRequest.transfer?.unit ?? 'units',
        mode: req.body.transportMode ?? currentRequest.transfer?.mode ?? '',
        eta: req.body.eta ?? currentRequest.transfer?.eta ?? '',
        supportingContact: req.body.supportingContact ?? currentRequest.transfer?.supportingContact ?? '',
        receivingContact: req.body.receivingContact ?? currentRequest.transfer?.receivingContact ?? '',
        handoffLocation: req.body.handoffLocation ?? currentRequest.transfer?.handoffLocation ?? '',
        notes: req.body.transferNotes ?? currentRequest.transfer?.notes ?? ''
      },
      approvals: {
        ...(currentRequest.approvals || {})
      },
      verification: {
        ...(currentRequest.verification || {}),
        receiptNote: req.body.receiptNote ?? currentRequest.verification?.receiptNote ?? '',
        evidenceSummary: req.body.evidenceSummary ?? currentRequest.verification?.evidenceSummary ?? '',
        impactSummary: req.body.impactSummary ?? currentRequest.verification?.impactSummary ?? '',
        beneficiaryDelta: Number(req.body.beneficiaryDelta ?? currentRequest.verification?.beneficiaryDelta) || 0
      },
      lastUpdatedBy: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role
      },
      history: appendNetworkHistory(currentRequest, {
        type: action || nextStatus,
        status: nextStatus,
        note: req.body.note || `Request moved to ${networkRequestStatusLabel(nextStatus)}.`,
        actor: req.user
      })
    };

    if (nextStatus === 'approved_support') {
      updatedRequest.approvals.supportingApprovedAt = updatedRequest.approvals.supportingApprovedAt || new Date().toISOString();
      updatedRequest.approvals.supportingApprovedBy = updatedRequest.approvals.supportingApprovedBy || cloneActor(req.user);
      updatedRequest = await applyVolunteerTransferEffects(updatedRequest);
    }

    if (nextStatus === 'delivered') {
      updatedRequest.approvals.deliveryConfirmedAt = updatedRequest.approvals.deliveryConfirmedAt || new Date().toISOString();
      updatedRequest.approvals.deliveryConfirmedBy = updatedRequest.approvals.deliveryConfirmedBy || cloneActor(req.user);
      updatedRequest = await applyInventoryTransferEffects(updatedRequest, req.user);
      if (!updatedRequest.execution?.effectsAppliedAt) {
        updatedRequest.execution = {
          ...(updatedRequest.execution || {}),
          effectsAppliedAt: new Date().toISOString()
        };
      }
    }

    if (nextStatus === 'verified') {
      updatedRequest.approvals.receiptVerifiedAt = updatedRequest.approvals.receiptVerifiedAt || new Date().toISOString();
      updatedRequest.approvals.receiptVerifiedBy = updatedRequest.approvals.receiptVerifiedBy || cloneActor(req.user);
      updatedRequest.verification.impactSummary = updatedRequest.verification.impactSummary
        || `Support from ${updatedRequest.supportingOrganizationShortName} was verified by ${updatedRequest.requestingOrganizationShortName}.`;
      updatedRequest.execution = {
        ...(updatedRequest.execution || {}),
        effectsAppliedAt: updatedRequest.execution?.effectsAppliedAt || new Date().toISOString()
      };
    }

    if (nextStatus === 'closed') {
      updatedRequest.approvals.closedAt = updatedRequest.approvals.closedAt || new Date().toISOString();
      updatedRequest.approvals.closedBy = updatedRequest.approvals.closedBy || cloneActor(req.user);
    }

    await setDocument('networkRequests', updatedRequest.id, updatedRequest);
    await createDispatchLog(
      `Mutual aid request ${networkRequestStatusLabel(nextStatus).toLowerCase()}: ${updatedRequest.requestingOrganizationShortName} -> ${updatedRequest.supportingOrganizationShortName}`,
      updatedRequest.summary,
      'logged',
      'network'
    );
    await createNotification(
      'network_request_update',
      `Mutual aid request ${networkRequestStatusLabel(nextStatus).toLowerCase()}`,
      `${updatedRequest.requestingOrganizationShortName} to ${updatedRequest.supportingOrganizationShortName}: ${updatedRequest.summary}`
    );
    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        source: 'network-board'
      },
      action: 'network_request_updated',
      entityType: 'network_request',
      entityId: updatedRequest.id,
      summary: `Mutual aid request marked ${nextStatus}.`,
      metadata: {
        type: updatedRequest.type,
        status: nextStatus,
        requestingOrganizationId: updatedRequest.requestingOrganizationId,
        supportingOrganizationId: updatedRequest.supportingOrganizationId
      },
      severity: nextStatus === 'cancelled' ? 'warning' : 'info'
    });

    return res.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Update network request error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update network request' });
  }
}

async function listDispatchLogs(req, res) {
  const logs = await getDispatchLogs();
  res.json(logs.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
}

async function listNotifications(req, res) {
  const notifications = await getNotifications();
  res.json(notifications.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
}

async function chatbot(req, res) {
  try {
    const user = await resolveOptionalUser(req);
    const page = String(req.body.page || '/');
    const message = String(req.body.message || '').trim();
    const explicitRole = String(req.body.role || '').trim();
    const role = user?.role || explicitRole || 'viewer';

    const [needs, volunteers, assignments, notifications, reviewQueue, inventory] = await Promise.all([
      getNeeds(),
      getVolunteers(),
      getAssignments(),
      getNotifications(),
      getReviewQueue(),
      getInventory()
    ]);

    const hydratedNeeds = await Promise.all(needs.map((need) => hydrateNeed(need, assignments, volunteers, inventory)));
    const sortedNotifications = notifications
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 8);
    const pendingReviewItems = reviewQueue
      .filter((item) => item.status === 'pending')
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 6);

    const pageLabelMap = {
      '/': 'the landing page',
      '/dashboard': 'Mission Control',
      '/intake': 'the Data Intake page',
      '/approval-queue': 'the Approval Queue',
      '/volunteer': 'the Volunteer Portal',
      '/login': 'the sign-in page',
      '/register': 'the registration page'
    };

    const snapshot = {
      needs: hydratedNeeds,
      volunteers,
      assignments: assignments.slice(0, 20),
      notifications: sortedNotifications,
      reviewQueue: pendingReviewItems,
      inventory: inventory.slice(0, 12),
      metrics: {
        totalNeeds: hydratedNeeds.length,
        urgentNeeds: hydratedNeeds.filter((need) => ['High', 'Critical'].includes(need.urgency)).length,
        openNeeds: hydratedNeeds.filter((need) => Number(need.openSpots || need.volunteersNeeded || 0) > 0).length,
        escalatedNeeds: hydratedNeeds.filter((need) => ['escalated', 'acknowledged'].includes(need.escalation?.status)).length,
        activeAssignments: assignments.filter((assignment) => assignment.status !== 'completed').length,
        unreadNotifications: sortedNotifications.filter((notification) => !notification.read).length,
        pendingReviews: pendingReviewItems.length,
        lowInventory: inventory.filter((item) => item.status === 'low').length
      }
    };

    const assistant = await generateChatbotReply({
      message: message || 'Give me a quick operational summary.',
      role,
      pageLabel: pageLabelMap[page] || 'the current page',
      snapshot
    });

    res.json({
      success: true,
      reply: assistant.reply,
      actions: assistant.actions || [],
      suggestedPrompts: assistant.suggestedPrompts || []
    });
  } catch (error) {
    console.error('Chatbot route error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate chatbot response', details: error.message });
  }
}

async function markNotificationsRead(req, res) {
  const { id } = req.body;

  if (id) {
    const notification = await getDocument('notifications', id);
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    await updateDocument('notifications', id, { read: true });
  } else {
    const notifications = await getNotifications();
    await Promise.all(
      notifications.map((notification) => updateDocument('notifications', notification.id, { read: true }))
    );
  }

  res.json({ success: true, notifications: await getNotifications() });
}

async function incomingSms(req, res) {
  const body = String(req.body.Body || '').trim();
  const from = req.body.From || 'unknown';

  const reviewItem = buildReviewItem({
    title: body ? `SMS Intake: ${body.slice(0, 48)}` : 'SMS Intake Alert',
    location: req.body.FromCity || 'SMS Report Location Pending',
    category: 'Logistics',
    urgency: 'High',
    notes: body || 'No message body provided.',
    volunteersNeeded: 3,
    source: 'sms',
    submittedBy: from
  });

  await setDocument('reviewQueue', reviewItem.id, reviewItem);
  await createNotification(
    'sms_intake',
    'SMS intake created a new task',
    `A new logistics draft from SMS sender ${from} is waiting in the approval queue.`
  );
  await createNotification(
    'review_queue',
    'SMS draft awaiting approval',
    `${reviewItem.fields.title} was captured from SMS and requires coordinator approval.`
  );

  await createDispatchLog(
    `SMS from ${from} converted into an approval-queue draft`,
    'response-team@demo.local',
    'queued',
    'email-simulation'
  );
  await logAuditEvent({
    actor: {
      uid: from,
      email: '',
      role: 'external',
      source: 'sms'
    },
    action: 'sms_intake_received',
    entityType: 'review_queue',
    entityId: reviewItem.id,
    summary: `SMS intake from ${from} created a review draft.`,
    metadata: {
      from,
      source: 'sms',
      title: reviewItem.fields.title
    },
    severity: 'info'
  });

  res.type('text/xml');
  res.send('<Response><Message>ResourceSync received your report. Dispatch review has started.</Message></Response>');
}

module.exports = {
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
  listAuditTrail,
  listDispatchLogs,
  listNotifications,
  markNotificationsRead,
  scanNeedFromImage,
  updateNetworkRequestStatus
};
