const {
  enrichVolunteer,
  getDocument,
  getOrganizationMeta,
  getUserProfile,
  listCollection,
  setDocument,
  setUserProfile
} = require('../models/dataStore');
const { summarizeStatus } = require('../utils/roleHelpers');

const ESCALATION_WINDOWS_MINUTES = {
  Critical: 30,
  High: 90,
  Medium: 240,
  Low: 480
};

const URGENCY_BASE_SCORES = {
  Critical: 42,
  High: 30,
  Medium: 18,
  Low: 8
};

const sdgByCategory = {
  Medical: { id: 'SDG 3', label: 'Good Health and Well-Being' },
  Food: { id: 'SDG 2', label: 'Zero Hunger' },
  Education: { id: 'SDG 4', label: 'Quality Education' },
  Logistics: { id: 'SDG 11', label: 'Sustainable Cities and Communities' },
  Labor: { id: 'SDG 8', label: 'Decent Work and Economic Growth' }
};

function minutesSince(timestamp) {
  if (!timestamp) {
    return 0;
  }

  const parsed = new Date(timestamp).getTime();
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(Math.round((Date.now() - parsed) / 60000), 0);
}

function buildEscalationState(need, activeAssignmentsCount, context = {}) {
  const existingEscalation = need.escalation || {};
  const urgency = String(need.urgency || 'Medium');
  const thresholdMinutes = ESCALATION_WINDOWS_MINUTES[urgency] || ESCALATION_WINDOWS_MINUTES.Medium;
  const ageMinutes = minutesSince(need.createdAt);
  const openSpots = Math.max((Number(need.volunteersNeeded) || 0) - activeAssignmentsCount, 0);
  const beneficiaryCount = Number(need.outcome?.beneficiaryCount || 0);
  const lowInventoryItems = Array.isArray(context.inventory)
    ? context.inventory.filter((item) => {
      const matchesCategory = item.linkedNeedCategory
        ? String(item.linkedNeedCategory) === String(need.category)
        : String(item.category) === String(need.category);
      return matchesCategory && Number(item.quantity || 0) <= Number(item.threshold || 0);
    })
    : [];
  const qualifiedVolunteers = Array.isArray(context.volunteers)
    ? context.volunteers.filter((volunteer) => {
      const certifications = volunteer.certifications || [];
      const badgeEligible = !need.requiredBadge || certifications.includes(need.requiredBadge);
      const skillEligible = !need.category || volunteer.skill === need.category;
      return badgeEligible && skillEligible;
    })
    : [];
  const agePressure = Math.min(28, Math.round((ageMinutes / Math.max(thresholdMinutes, 1)) * 20));
  const openSpotPressure = Math.min(18, openSpots * 6);
  const beneficiaryPressure = Math.min(12, Math.ceil(beneficiaryCount / 20) * 3);
  const inventoryPressure = Math.min(10, lowInventoryItems.length * 5);
  const certificationPressure = need.requiredBadge ? 6 : 0;
  const coveragePressure = openSpots > Math.max(qualifiedVolunteers.length, 0) ? 10 : 0;
  const score = Math.min(
    100,
    (URGENCY_BASE_SCORES[urgency] || URGENCY_BASE_SCORES.Medium)
      + agePressure
      + openSpotPressure
      + beneficiaryPressure
      + inventoryPressure
      + certificationPressure
      + coveragePressure
  );
  const reasons = [
    `Urgency set to ${urgency}.`,
    ageMinutes > 0 ? `Waiting ${ageMinutes} minute${ageMinutes === 1 ? '' : 's'} since intake.` : null,
    openSpots > 0 ? `${openSpots} volunteer slot${openSpots === 1 ? '' : 's'} still open.` : 'Coverage is currently full.',
    beneficiaryCount > 0 ? `${beneficiaryCount} beneficiaries currently recorded.` : null,
    lowInventoryItems.length ? `${lowInventoryItems.length} linked inventory item${lowInventoryItems.length === 1 ? '' : 's'} are under threshold.` : null,
    need.requiredBadge ? `Requires badge ${need.requiredBadge}.` : null,
    coveragePressure ? 'Qualified volunteer pool is smaller than the remaining open slots.' : null
  ].filter(Boolean);
  const priorityBand = score >= 85 ? 'Escalated' : score >= 65 ? 'Critical' : score >= 40 ? 'Priority' : 'Normal';
  const recommendedAction = score >= 85
    ? 'Immediate coordinator intervention and direct outreach recommended.'
    : score >= 65
      ? 'Prioritize assignment and confirm supply readiness.'
      : score >= 40
        ? 'Monitor closely and pre-stage volunteers.'
        : 'Continue normal queue monitoring.';
  const shouldEscalate = openSpots > 0 && ['Critical', 'High', 'Medium'].includes(urgency) && (ageMinutes >= thresholdMinutes || score >= 85);

  if (!shouldEscalate) {
    if (existingEscalation.status === 'acknowledged') {
      return {
        ...existingEscalation,
        level: null,
        trigger: null,
        resolvedAt: existingEscalation.resolvedAt || new Date().toISOString(),
        score,
        reasons,
        priorityBand,
        recommendedAction,
        ageMinutes,
        openSpots,
        responseWindowMinutes: thresholdMinutes
      };
    }

    return {
      status: 'none',
      level: null,
      trigger: null,
      lastEscalatedAt: null,
      acknowledgedAt: existingEscalation.acknowledgedAt || null,
      acknowledgedBy: existingEscalation.acknowledgedBy || null,
      resolvedAt: existingEscalation.resolvedAt || null,
      score,
      reasons,
      priorityBand,
      recommendedAction,
      ageMinutes,
      openSpots,
      responseWindowMinutes: thresholdMinutes
    };
  }

  const level = urgency === 'Critical' ? 'critical' : urgency === 'High' ? 'high' : 'warning';
  const trigger = `Priority score ${score}/100. No full coverage after ${ageMinutes} minutes with ${openSpots} open volunteer slot${openSpots === 1 ? '' : 's'}.`;
  const escalatedAt = existingEscalation.lastEscalatedAt || new Date().toISOString();

  return {
    status: existingEscalation.status === 'acknowledged' ? 'acknowledged' : 'escalated',
    level,
    trigger,
    lastEscalatedAt: escalatedAt,
    acknowledgedAt: existingEscalation.acknowledgedAt || null,
    acknowledgedBy: existingEscalation.acknowledgedBy || null,
    resolvedAt: null,
    score,
    reasons,
    priorityBand,
    recommendedAction,
    ageMinutes,
    openSpots,
    responseWindowMinutes: thresholdMinutes
  };
}

async function syncNeedEscalation(need, actor = null, activeAssignmentsCount = null) {
  const resolvedAssignments = activeAssignmentsCount ?? (await getAssignments())
    .filter((assignment) => String(assignment.needId) === String(need.id) && assignment.status !== 'completed')
    .length;

  const nextEscalation = buildEscalationState(need, resolvedAssignments);
  const currentEscalation = need.escalation || {};
  const statusChanged = currentEscalation.status !== nextEscalation.status
    || currentEscalation.level !== nextEscalation.level
    || currentEscalation.trigger !== nextEscalation.trigger;

  if (!statusChanged) {
    return {
      ...need,
      escalation: nextEscalation
    };
  }

  const nextNeed = {
    ...need,
    escalation: nextEscalation
  };

  await setDocument('needs', String(need.id), nextNeed);

  if (nextEscalation.status === 'escalated') {
    await createNotification(
      'escalation',
      `${need.urgency} need escalated`,
      `${need.title} in ${need.location} needs intervention: ${nextEscalation.trigger}`
    );

    await logAuditEvent({
      actor: actor || {
        uid: 'system',
        email: 'system@resourcesync.local',
        role: 'system',
        source: 'escalation-engine'
      },
      action: 'need_escalated',
      entityType: 'need',
      entityId: need.id,
      summary: `${need.title} escalated for coordinator/admin attention.`,
      metadata: {
        urgency: need.urgency,
        level: nextEscalation.level,
        trigger: nextEscalation.trigger
      },
      severity: nextEscalation.level === 'critical' ? 'high' : 'medium'
    });
  }

  if (currentEscalation.status === 'acknowledged' && nextEscalation.status === 'none') {
    await logAuditEvent({
      actor: actor || {
        uid: 'system',
        email: 'system@resourcesync.local',
        role: 'system',
        source: 'escalation-engine'
      },
      action: 'need_escalation_resolved',
      entityType: 'need',
      entityId: need.id,
      summary: `${need.title} is no longer in escalation state.`,
      metadata: {
        urgency: need.urgency
      },
      severity: 'info'
    });
  }

  return nextNeed;
}

async function getEscalatedNeeds(actor = null) {
  const [needs, assignments, volunteers, inventory] = await Promise.all([getNeeds(), getAssignments(), getVolunteers(), getInventory()]);
  const hydratedNeeds = await Promise.all(
    needs.map(async (need) => {
      const activeAssignmentsCount = assignments.filter(
        (assignment) => String(assignment.needId) === String(need.id) && assignment.status !== 'completed'
      ).length;
      const syncedNeed = await syncNeedEscalation(need, actor, activeAssignmentsCount);
      return hydrateNeed(syncedNeed, assignments, volunteers, inventory);
    })
  );

  return hydratedNeeds
    .filter((need) => ['escalated', 'acknowledged'].includes(need.escalation?.status))
    .sort((left, right) => Number(right.escalation?.score || 0) - Number(left.escalation?.score || 0));
}

async function getNeeds() {
  return listCollection('needs');
}

async function getOrganizations() {
  return listCollection('organizations');
}

async function getVolunteers() {
  const volunteers = await listCollection('volunteers');
  return volunteers.map(enrichVolunteer);
}

async function getAssignments() {
  return listCollection('assignments');
}

async function getNetworkRequests() {
  return listCollection('networkRequests');
}

async function getMarketplaceListings() {
  return listCollection('marketplaceListings');
}

async function getInventory() {
  return listCollection('inventory');
}

async function getDispatchLogs() {
  return listCollection('dispatchLogs');
}

async function getAuditLogs() {
  return listCollection('auditLogs');
}

async function getNotifications() {
  return listCollection('notifications');
}

async function getReviewQueue() {
  return listCollection('reviewQueue');
}

async function getVolunteerById(volunteerId) {
  const volunteer = await getDocument('volunteers', volunteerId);
  return volunteer ? enrichVolunteer(volunteer) : null;
}

async function getNeedById(needId) {
  return getDocument('needs', needId);
}

async function createDispatchLog(summary, target, status = 'queued', channel = 'assignment') {
  const dispatchLog = {
    id: `dispatch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    channel,
    target,
    summary,
    status,
    createdAt: new Date().toISOString()
  };

  await setDocument('dispatchLogs', dispatchLog.id, dispatchLog);
  return dispatchLog;
}

async function createNotification(type, title, message) {
  const notification = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString()
  };

  await setDocument('notifications', notification.id, notification);
  return notification;
}

function normalizeActor(actor = {}) {
  return {
    uid: actor.uid || 'system',
    email: actor.email || '',
    role: actor.role || 'system',
    source: actor.source || 'api'
  };
}

async function logAuditEvent({
  actor,
  action,
  entityType,
  entityId,
  summary,
  metadata = {},
  severity = 'info'
}) {
  const auditLog = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    action,
    entityType,
    entityId: entityId ? String(entityId) : '',
    severity,
    summary,
    actor: normalizeActor(actor),
    metadata,
    createdAt: new Date().toISOString()
  };

  await setDocument('auditLogs', auditLog.id, auditLog);
  return auditLog;
}

async function buildAssignmentView(assignment, volunteersById = null) {
  const volunteer = volunteersById?.get(String(assignment.volunteerId)) || await getVolunteerById(assignment.volunteerId);
  const organization = getOrganizationMeta(assignment.organizationId || volunteer?.organizationId);
  return {
    ...assignment,
    evidence: Array.isArray(assignment.evidence) ? assignment.evidence : [],
    verifiedCompletion: assignment.verifiedCompletion || null,
    volunteerName: volunteer?.name || 'Unknown Volunteer',
    volunteerSkill: volunteer?.skill || 'General',
    volunteerLocation: volunteer?.location || 'Unknown',
    organizationId: assignment.organizationId || organization.id,
    organizationName: assignment.organizationName || volunteer?.organizationName || organization.name,
    organizationShortName: assignment.organizationShortName || volunteer?.organizationShortName || organization.shortName,
    statusLabel: summarizeStatus(assignment.status)
  };
}

async function hydrateNeed(need, assignments = null, volunteers = null, inventory = null) {
  const resolvedAssignments = assignments || await getAssignments();
  const resolvedVolunteers = volunteers || await getVolunteers();
  const resolvedInventory = inventory || await getInventory();
  const volunteersById = new Map(resolvedVolunteers.map((volunteer) => [String(volunteer.id), volunteer]));

  const currentAssignments = await Promise.all(
    resolvedAssignments
      .filter((assignment) => String(assignment.needId) === String(need.id))
      .map((assignment) => buildAssignmentView(assignment, volunteersById))
  );

  const activeAssignments = currentAssignments.filter((assignment) => assignment.status !== 'completed');
  const escalation = buildEscalationState(need, activeAssignments.length, {
    volunteers: resolvedVolunteers,
    inventory: resolvedInventory
  });

  return {
    ...need,
    currentAssignments,
    escalation,
    sdg: sdgByCategory[need.category] || { id: 'SDG 11', label: 'Sustainable Cities and Communities' },
    volunteersMatched: Math.max(Number(need.volunteersMatched) || 0, activeAssignments.length),
    openSpots: Math.max((Number(need.volunteersNeeded) || 0) - activeAssignments.length, 0)
  };
}

async function buildOperationsInsights() {
  const [needs, assignments, volunteers, inventory] = await Promise.all([
    getNeeds(),
    getAssignments(),
    getVolunteers(),
    getInventory()
  ]);
  const hydratedNeeds = await Promise.all(needs.map((need) => hydrateNeed(need, assignments, volunteers, inventory)));
  const categoryDemand = hydratedNeeds.reduce((accumulator, need) => {
    accumulator[need.category] = (accumulator[need.category] || 0) + 1;
    return accumulator;
  }, {});
  const hotspotDemand = hydratedNeeds.reduce((accumulator, need) => {
    accumulator[need.location] = (accumulator[need.location] || 0) + 1;
    return accumulator;
  }, {});
  const lowInventory = inventory.filter((item) => Number(item.quantity || 0) <= Number(item.threshold || 0));
  const resolvedNeeds = hydratedNeeds.filter((need) => need.outcome?.status === 'resolved');
  const openNeeds = hydratedNeeds.filter((need) => !['resolved', 'closed'].includes(need.outcome?.status));

  const forecastCategories = Object.entries(categoryDemand)
    .map(([category, count]) => {
      const relatedInventory = inventory.filter((item) => item.linkedNeedCategory === category);
      const inventoryPressure = relatedInventory.some((item) => Number(item.quantity || 0) <= Number(item.threshold || 0)) ? 'inventory constrained' : 'inventory stable';
      return {
        category,
        currentNeeds: count,
        forecastLevel: count >= 2 ? 'rising' : 'stable',
        rationale: `${count} live need${count === 1 ? '' : 's'} in ${category} and ${inventoryPressure}.`
      };
    })
    .sort((left, right) => right.currentNeeds - left.currentNeeds);

  const hotspotForecast = Object.entries(hotspotDemand)
    .map(([location, count]) => ({
      location,
      currentNeeds: count,
      forecastLevel: count >= 2 ? 'watch' : 'monitor'
    }))
    .sort((left, right) => right.currentNeeds - left.currentNeeds)
    .slice(0, 5);

  const sdgRows = Object.values(hydratedNeeds.reduce((accumulator, need) => {
    const sdg = sdgByCategory[need.category] || { id: 'SDG 11', label: 'Sustainable Cities and Communities' };
    const key = sdg.id;
    if (!accumulator[key]) {
      accumulator[key] = {
        ...sdg,
        needs: 0,
        resolved: 0,
        beneficiaries: 0
      };
    }

    accumulator[key].needs += 1;
    accumulator[key].resolved += need.outcome?.status === 'resolved' ? 1 : 0;
    accumulator[key].beneficiaries += Number(need.outcome?.beneficiaryCount || 0);
    return accumulator;
  }, {}));

  return {
    summary: {
      resolvedNeeds: resolvedNeeds.length,
      openNeeds: openNeeds.length,
      lowInventoryCount: lowInventory.length,
      trainedVolunteers: volunteers.filter((volunteer) => (volunteer.certifications || []).length > 0).length,
      escalatedNeeds: hydratedNeeds.filter((need) => need.escalation?.status === 'escalated').length
    },
    predictiveInsights: {
      categories: forecastCategories,
      hotspots: hotspotForecast,
      headline: hydratedNeeds.find((need) => need.escalation?.status === 'escalated')
        ? `${hydratedNeeds
          .filter((need) => need.escalation?.status === 'escalated')
          .sort((left, right) => Number(right.escalation?.score || 0) - Number(left.escalation?.score || 0))[0]
          .title} is leading the escalation queue with a score of ${hydratedNeeds
          .filter((need) => need.escalation?.status === 'escalated')
          .sort((left, right) => Number(right.escalation?.score || 0) - Number(left.escalation?.score || 0))[0]
          .escalation?.score || 0}/100.`
        : forecastCategories[0]
          ? `${forecastCategories[0].category} demand looks ${forecastCategories[0].forecastLevel} based on the current workload and inventory signal.`
          : 'Not enough live demand yet to forecast the next surge.'
    },
    inventoryPressure: lowInventory,
    sdgImpact: sdgRows
  };
}

async function ensureUserProfile(uid, payload) {
  const profile = await getUserProfile(uid);
  if (profile) {
    return profile;
  }

  await setUserProfile(uid, payload);
  return getUserProfile(uid);
}

module.exports = {
  buildAssignmentView,
  createDispatchLog,
  createNotification,
  ensureUserProfile,
  getAuditLogs,
  getAssignments,
  getDispatchLogs,
  getEscalatedNeeds,
  getMarketplaceListings,
  getInventory,
  getNetworkRequests,
  getNeedById,
  getNeeds,
  getOrganizations,
  getNotifications,
  getReviewQueue,
  getUserProfile,
  getVolunteerById,
  getVolunteers,
  hydrateNeed,
  logAuditEvent,
  buildOperationsInsights,
  syncNeedEscalation,
  setUserProfile
};
