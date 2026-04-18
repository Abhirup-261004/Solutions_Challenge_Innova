const { connectMongo, isMongoConfigured, logMongoFallback, mongoose } = require('../config/db');
const { buildRewardProfile } = require('../utils/rewardHelpers');

const categoryCoordinates = {
  Medical: [40.7128, -74.006],
  Education: [40.7228, -73.996],
  Logistics: [40.706, -74.016],
  Labor: [40.718, -74.01],
  Food: [40.728, -74.002]
};

const genericSchema = new mongoose.Schema({}, { strict: false, versionKey: false });

const organizationCatalog = [
  { id: 'org-central', name: 'Central Relief Network', shortName: 'CRN', type: 'NGO', accent: '#00f0ff' },
  { id: 'org-harbor', name: 'Harbor Community Kitchen', shortName: 'HCK', type: 'Community Partner', accent: '#00ff88' },
  { id: 'org-westside', name: 'Westside Learning Alliance', shortName: 'WLA', type: 'Education Partner', accent: '#ff9500' }
];

const models = {
  organizations: mongoose.models.Organization || mongoose.model('Organization', genericSchema, 'organizations'),
  incidents: mongoose.models.Incident || mongoose.model('Incident', genericSchema, 'incidents'),
  needs: mongoose.models.Need || mongoose.model('Need', genericSchema, 'needs'),
  volunteers: mongoose.models.Volunteer || mongoose.model('Volunteer', genericSchema, 'volunteers'),
  inventory: mongoose.models.InventoryItem || mongoose.model('InventoryItem', genericSchema, 'inventory'),
  assignments: mongoose.models.Assignment || mongoose.model('Assignment', genericSchema, 'assignments'),
  networkRequests: mongoose.models.NetworkRequest || mongoose.model('NetworkRequest', genericSchema, 'networkRequests'),
  marketplaceListings: mongoose.models.MarketplaceListing || mongoose.model('MarketplaceListing', genericSchema, 'marketplaceListings'),
  auditLogs: mongoose.models.AuditLog || mongoose.model('AuditLog', genericSchema, 'auditLogs'),
  dispatchLogs: mongoose.models.DispatchLog || mongoose.model('DispatchLog', genericSchema, 'dispatchLogs'),
  notifications: mongoose.models.Notification || mongoose.model('Notification', genericSchema, 'notifications'),
  reviewQueue: mongoose.models.ReviewQueue || mongoose.model('ReviewQueue', genericSchema, 'reviewQueue'),
  users: mongoose.models.UserProfile || mongoose.model('UserProfile', genericSchema, 'users')
};

function hashString(input = '') {
  return Array.from(String(input)).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function inferCoordinates(location = '', category = 'Medical') {
  const base = categoryCoordinates[category] || [40.7128, -74.006];
  const hash = hashString(location || category);
  const latOffset = ((hash % 9) - 4) * 0.004;
  const lngOffset = ((Math.floor(hash / 9) % 9) - 4) * 0.004;
  return {
    lat: Number((base[0] + latOffset).toFixed(5)),
    lng: Number((base[1] + lngOffset).toFixed(5))
  };
}

function badgeForVolunteer(volunteer) {
  if (volunteer.skill === 'Medical') return 'Rapid Response Medic';
  if (volunteer.skill === 'Logistics') return 'Logistics Hero';
  if (volunteer.skill === 'Education') return 'Community Mentor';
  if (volunteer.skill === 'Labor') return 'Field Force';
  return 'Relief Champion';
}

function requiredBadgeForCategory(category = 'Medical') {
  if (category === 'Medical') return 'First Aid Ready';
  if (category === 'Food') return 'Food Safety Steward';
  if (category === 'Education') return 'Child Support Ally';
  return null;
}

function getOrganizationMeta(organizationId = 'org-central') {
  return organizationCatalog.find((organization) => organization.id === organizationId) || organizationCatalog[0];
}

function buildIncidentRecord(payload = {}) {
  const organization = getOrganizationMeta(payload.organizationId);
  return {
    id: String(payload.id || `incident-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    name: payload.name || 'Active Incident',
    code: payload.code || 'INC-001',
    type: payload.type || 'General Emergency',
    severity: payload.severity || 'High',
    status: payload.status || 'active',
    location: payload.location || 'Unknown',
    zone: payload.zone || payload.location || 'Zone A',
    summary: payload.summary || '',
    commander: payload.commander || 'Operations Lead',
    organizationId: payload.organizationId || organization.id,
    organizationName: payload.organizationName || organization.name,
    organizationShortName: payload.organizationShortName || organization.shortName,
    startedAt: payload.startedAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || payload.startedAt || new Date().toISOString(),
    targetResolutionHours: Number(payload.targetResolutionHours) || 24,
    affectedPopulation: Number(payload.affectedPopulation) || 0,
    coordinates: payload.coordinates || inferCoordinates(payload.location || payload.zone || 'Downtown', payload.type || 'Medical'),
    objectives: Array.isArray(payload.objectives) ? payload.objectives : [],
    phases: Array.isArray(payload.phases) ? payload.phases : []
  };
}

function enrichVolunteer(volunteer) {
  const hoursVolunteered = volunteer.hoursVolunteered ?? ((hashString(volunteer.name) % 18) + 6);
  const missionsCompleted = volunteer.missionsCompleted ?? ((hashString(volunteer.location) % 7) + 2);
  const certifications = Array.isArray(volunteer.certifications) ? volunteer.certifications : [];
  const inferredCertification = requiredBadgeForCategory(volunteer.skill);
  const trustBadges = Array.from(new Set([
    ...certifications,
    ...(inferredCertification ? [inferredCertification] : [])
  ]));

  const rewardProfile = buildRewardProfile({
    ...volunteer,
    hoursVolunteered,
    missionsCompleted,
    certifications: trustBadges,
    impactScore: volunteer.impactScore ?? (hoursVolunteered * 10 + missionsCompleted * 15)
  });

  return {
    ...volunteer,
    organizationId: volunteer.organizationId || getOrganizationMeta(volunteer.organizationId).id,
    organizationName: volunteer.organizationName || getOrganizationMeta(volunteer.organizationId).name,
    organizationShortName: volunteer.organizationShortName || getOrganizationMeta(volunteer.organizationId).shortName,
    hoursVolunteered,
    missionsCompleted,
    badge: volunteer.badge || badgeForVolunteer(volunteer),
    certifications: trustBadges,
    impactScore: volunteer.impactScore ?? (hoursVolunteered * 10 + missionsCompleted * 15),
    ...rewardProfile
  };
}

function buildNeedRecord(payload, createdBy = 'system') {
  const id = String(payload.id || Date.now());
  const organization = getOrganizationMeta(payload.organizationId);
  return {
    id,
    incidentId: payload.incidentId || null,
    incidentName: payload.incidentName || null,
    title: payload.title,
    location: payload.location,
    category: payload.category,
    urgency: payload.urgency,
    notes: payload.notes || '',
    volunteersNeeded: Number(payload.volunteersNeeded) || 1,
    volunteersMatched: Number(payload.volunteersMatched) || 0,
    requiredBadge: payload.requiredBadge ?? requiredBadgeForCategory(payload.category),
    organizationId: payload.organizationId || organization.id,
    organizationName: payload.organizationName || organization.name,
    organizationShortName: payload.organizationShortName || organization.shortName,
    createdBy,
    source: payload.source || 'dashboard',
    offlineCaptured: Boolean(payload.offlineCaptured),
    coordinates: payload.coordinates || inferCoordinates(payload.location, payload.category),
    createdAt: payload.createdAt || new Date().toISOString(),
    outcome: {
      status: payload.outcome?.status || payload.outcomeStatus || 'open',
      beneficiaryCount: Number(payload.outcome?.beneficiaryCount ?? payload.beneficiaryCount) || 0,
      summary: payload.outcome?.summary || payload.outcomeSummary || '',
      updatedAt: payload.outcome?.updatedAt || null,
      updatedBy: payload.outcome?.updatedBy || null,
      resolvedAt: payload.outcome?.resolvedAt || null
    },
    escalation: {
      status: payload.escalation?.status || 'none',
      level: payload.escalation?.level || null,
      trigger: payload.escalation?.trigger || null,
      lastEscalatedAt: payload.escalation?.lastEscalatedAt || null,
      acknowledgedAt: payload.escalation?.acknowledgedAt || null,
      acknowledgedBy: payload.escalation?.acknowledgedBy || null,
      resolvedAt: payload.escalation?.resolvedAt || null
    }
  };
}

function buildInventoryRecord(payload, createdBy = 'system') {
  const id = String(payload.id || `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
  const quantity = Number(payload.quantity) || 0;
  const threshold = Number(payload.threshold) || 0;
  const organization = getOrganizationMeta(payload.organizationId);
  return {
    id,
    incidentId: payload.incidentId || null,
    incidentName: payload.incidentName || null,
    name: payload.name,
    category: payload.category || 'Supplies',
    unit: payload.unit || 'units',
    location: payload.location || 'Central Warehouse',
    quantity,
    threshold,
    status: quantity <= threshold ? 'low' : 'healthy',
    linkedNeedCategory: payload.linkedNeedCategory || null,
    organizationId: payload.organizationId || organization.id,
    organizationName: payload.organizationName || organization.name,
    organizationShortName: payload.organizationShortName || organization.shortName,
    notes: payload.notes || '',
    createdBy,
    updatedAt: payload.updatedAt || new Date().toISOString()
  };
}

function buildReviewItem(payload) {
  const organization = getOrganizationMeta(payload.organizationId);
  return {
    id: String(payload.id || `review-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    source: payload.source || 'ocr',
    status: payload.status || 'pending',
    createdAt: payload.createdAt || new Date().toISOString(),
    submittedBy: payload.submittedBy || 'system',
    reviewedAt: payload.reviewedAt || null,
    reviewedBy: payload.reviewedBy || null,
    rejectionReason: payload.rejectionReason || null,
    organizationId: payload.organizationId || organization.id,
    organizationName: payload.organizationName || organization.name,
    organizationShortName: payload.organizationShortName || organization.shortName,
    fields: {
      title: payload.fields?.title || payload.title || '',
      location: payload.fields?.location || payload.location || '',
      category: payload.fields?.category || payload.category || 'Medical',
      urgency: payload.fields?.urgency || payload.urgency || 'Medium',
      requiredBadge: payload.fields?.requiredBadge ?? payload.requiredBadge ?? requiredBadgeForCategory(payload.fields?.category || payload.category || 'Medical'),
      notes: payload.fields?.notes || payload.notes || '',
      volunteersNeeded: Number(payload.fields?.volunteersNeeded ?? payload.volunteersNeeded) || 1
    }
  };
}

function buildNetworkRequest(payload, actor = {}) {
  const requestingOrganization = getOrganizationMeta(payload.requestingOrganizationId);
  const supportingOrganization = getOrganizationMeta(payload.supportingOrganizationId);
  const now = payload.createdAt || new Date().toISOString();
  const actorPayload = {
    uid: actor.uid || payload.createdBy?.uid || 'system',
    email: actor.email || payload.createdBy?.email || '',
    role: actor.role || payload.createdBy?.role || 'system'
  };

  return {
    id: String(payload.id || `network-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    incidentId: payload.incidentId || null,
    incidentName: payload.incidentName || null,
    type: payload.type || 'volunteer_support',
    status: payload.status || 'requested',
    priority: payload.priority || 'watch',
    summary: payload.summary || 'Mutual aid coordination request created.',
    detail: payload.detail || '',
    resourceCategory: payload.resourceCategory || 'General',
    relatedNeedId: payload.relatedNeedId || null,
    relatedInventoryItemId: payload.relatedInventoryItemId || null,
    requestingOrganizationId: payload.requestingOrganizationId || requestingOrganization.id,
    requestingOrganizationName: payload.requestingOrganizationName || requestingOrganization.name,
    requestingOrganizationShortName: payload.requestingOrganizationShortName || requestingOrganization.shortName,
    supportingOrganizationId: payload.supportingOrganizationId || supportingOrganization.id,
    supportingOrganizationName: payload.supportingOrganizationName || supportingOrganization.name,
    supportingOrganizationShortName: payload.supportingOrganizationShortName || supportingOrganization.shortName,
    suggestedUnits: Number(payload.suggestedUnits) || 0,
    candidateCount: Number(payload.candidateCount) || 0,
    recommendedVolunteerIds: Array.isArray(payload.recommendedVolunteerIds) ? payload.recommendedVolunteerIds : [],
    recommendedInventoryItemIds: Array.isArray(payload.recommendedInventoryItemIds) ? payload.recommendedInventoryItemIds : [],
    transfer: {
      quantity: Number(payload.transfer?.quantity ?? payload.suggestedUnits) || 0,
      unit: payload.transfer?.unit || payload.unit || 'units',
      mode: payload.transfer?.mode || '',
      eta: payload.transfer?.eta || '',
      supportingContact: payload.transfer?.supportingContact || '',
      receivingContact: payload.transfer?.receivingContact || '',
      handoffLocation: payload.transfer?.handoffLocation || '',
      notes: payload.transfer?.notes || ''
    },
    approvals: {
      requesterConfirmedAt: payload.approvals?.requesterConfirmedAt || now,
      requesterConfirmedBy: payload.approvals?.requesterConfirmedBy || actorPayload,
      supportingApprovedAt: payload.approvals?.supportingApprovedAt || null,
      supportingApprovedBy: payload.approvals?.supportingApprovedBy || null,
      deliveryConfirmedAt: payload.approvals?.deliveryConfirmedAt || null,
      deliveryConfirmedBy: payload.approvals?.deliveryConfirmedBy || null,
      receiptVerifiedAt: payload.approvals?.receiptVerifiedAt || null,
      receiptVerifiedBy: payload.approvals?.receiptVerifiedBy || null,
      closedAt: payload.approvals?.closedAt || null,
      closedBy: payload.approvals?.closedBy || null
    },
    verification: {
      receiptNote: payload.verification?.receiptNote || '',
      evidenceSummary: payload.verification?.evidenceSummary || '',
      impactSummary: payload.verification?.impactSummary || '',
      beneficiaryDelta: Number(payload.verification?.beneficiaryDelta) || 0
    },
    execution: {
      volunteerAssignmentsCreated: Array.isArray(payload.execution?.volunteerAssignmentsCreated) ? payload.execution.volunteerAssignmentsCreated : [],
      inventoryTransfersApplied: Array.isArray(payload.execution?.inventoryTransfersApplied) ? payload.execution.inventoryTransfersApplied : [],
      effectsAppliedAt: payload.execution?.effectsAppliedAt || null
    },
    history: Array.isArray(payload.history) && payload.history.length ? payload.history : [{
      id: `network-history-${Date.now()}`,
      type: 'created',
      status: payload.status || 'requested',
      note: payload.historyNote || 'Mutual aid request opened.',
      actor: actorPayload,
      createdAt: now
    }],
    createdAt: now,
    updatedAt: payload.updatedAt || now,
    resolvedAt: payload.resolvedAt || null,
    createdBy: actorPayload
  };
}

function buildMarketplaceListing(payload = {}, actor = {}) {
  const organization = getOrganizationMeta(payload.organizationId);
  const now = payload.createdAt || new Date().toISOString();
  const actorPayload = {
    uid: actor.uid || payload.createdBy?.uid || 'system',
    email: actor.email || payload.createdBy?.email || '',
    role: actor.role || payload.createdBy?.role || 'system'
  };

  return {
    id: String(payload.id || `listing-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    listingType: payload.listingType || 'offer',
    resourceType: payload.resourceType || 'inventory',
    status: payload.status || 'open',
    source: payload.source || 'manual',
    title: payload.title || 'Marketplace listing',
    detail: payload.detail || '',
    priority: payload.priority || 'watch',
    resourceCategory: payload.resourceCategory || payload.category || 'General',
    quantity: Number(payload.quantity) || 0,
    unit: payload.unit || 'units',
    location: payload.location || 'Network hub',
    organizationId: payload.organizationId || organization.id,
    organizationName: payload.organizationName || organization.name,
    organizationShortName: payload.organizationShortName || organization.shortName,
    targetOrganizationId: payload.targetOrganizationId || null,
    inventoryItemId: payload.inventoryItemId || null,
    volunteerIds: Array.isArray(payload.volunteerIds) ? payload.volunteerIds : [],
    certificationHints: Array.isArray(payload.certificationHints) ? payload.certificationHints : [],
    linkedNeedId: payload.linkedNeedId || null,
    linkedNetworkRequestId: payload.linkedNetworkRequestId || null,
    matchedOrganizationId: payload.matchedOrganizationId || null,
    metadata: payload.metadata || {},
    createdAt: now,
    updatedAt: payload.updatedAt || now,
    convertedAt: payload.convertedAt || null,
    createdBy: actorPayload
  };
}

const initialData = {
  organizations: organizationCatalog,
  incidents: [
    buildIncidentRecord({
      id: 'incident-heatwave-01',
      name: 'Central Heatwave Response',
      code: 'INC-HW-01',
      type: 'Medical',
      severity: 'Critical',
      status: 'active',
      location: 'Downtown Corridor',
      zone: 'Zone Alpha',
      summary: 'A severe heatwave is driving simultaneous medical, hydration, and outreach demand across the downtown corridor.',
      commander: 'Maya Rao',
      organizationId: 'org-central',
      targetResolutionHours: 18,
      affectedPopulation: 1260,
      objectives: [
        'Stabilize emergency medical sorting throughput.',
        'Expand hydration coverage for high-risk residents.',
        'Reduce response delay for critical requests under 30 minutes.'
      ],
      phases: ['Triage', 'Volunteer Mobilization', 'Resource Transfer', 'Recovery']
    }),
    buildIncidentRecord({
      id: 'incident-flood-02',
      name: 'Westside Flood Recovery',
      code: 'INC-FL-02',
      type: 'Logistics',
      severity: 'High',
      status: 'monitoring',
      location: 'Westside',
      zone: 'Zone Bravo',
      summary: 'Localized flood recovery is creating shelter, education, and resupply pressure for displaced families.',
      commander: 'Lena Brooks',
      organizationId: 'org-westside',
      targetResolutionHours: 36,
      affectedPopulation: 740,
      objectives: [
        'Keep learning continuity services live for displaced students.',
        'Maintain blanket and kit availability at the westside hub.'
      ],
      phases: ['Assessment', 'Distribution', 'Community Recovery']
    })
  ],
  needs: [
    buildNeedRecord({
      id: '1',
      incidentId: 'incident-heatwave-01',
      incidentName: 'Central Heatwave Response',
      title: 'Emergency Medical Supplies Sorting',
      location: 'Downtown',
      category: 'Medical',
      urgency: 'Critical',
      notes: 'Boxes of emergency supplies need triage, sorting, and labeling for urgent deployment.',
      volunteersNeeded: 12,
      volunteersMatched: 4,
      organizationId: 'org-central'
    }),
    buildNeedRecord({
      id: '2',
      incidentId: 'incident-flood-02',
      incidentName: 'Westside Flood Recovery',
      title: 'After-school Math Tutoring',
      location: 'Westside',
      category: 'Education',
      urgency: 'Medium',
      notes: 'Tutors are needed for students displaced from regular classes after flooding.',
      volunteersNeeded: 4,
      volunteersMatched: 2,
      organizationId: 'org-westside'
    }),
    buildNeedRecord({
      id: '3',
      incidentId: 'incident-heatwave-01',
      incidentName: 'Central Heatwave Response',
      title: 'Community Kitchen Restock',
      location: 'Harbor Point',
      category: 'Food',
      urgency: 'High',
      notes: 'Meal kits and shelf-stable ingredients are running low for evening distribution.',
      volunteersNeeded: 7,
      volunteersMatched: 3,
      organizationId: 'org-harbor'
    })
  ],
  volunteers: [
    enrichVolunteer({ id: 'v1', name: 'Dr. Smith', skill: 'Medical', location: 'Downtown', radius: 5, hoursVolunteered: 28, missionsCompleted: 8, organizationId: 'org-central' }),
    enrichVolunteer({ id: 'v2', name: 'Jane Doe', skill: 'Education', location: 'Westside', radius: 15, hoursVolunteered: 19, missionsCompleted: 5, organizationId: 'org-westside' }),
    enrichVolunteer({ id: 'v3', name: 'Carlos Vega', skill: 'Logistics', location: 'Harbor Point', radius: 15, hoursVolunteered: 24, missionsCompleted: 6, organizationId: 'org-central' }),
    enrichVolunteer({ id: 'v4', name: 'Aisha Khan', skill: 'Food', location: 'Harbor Point', radius: 10, hoursVolunteered: 21, missionsCompleted: 5, organizationId: 'org-harbor' })
  ],
  inventory: [
    buildInventoryRecord({ id: 'inv-1', incidentId: 'incident-heatwave-01', incidentName: 'Central Heatwave Response', name: 'Trauma Kits', category: 'Medical', unit: 'kits', quantity: 24, threshold: 18, location: 'Downtown Depot', linkedNeedCategory: 'Medical', organizationId: 'org-central' }),
    buildInventoryRecord({ id: 'inv-2', incidentId: 'incident-heatwave-01', incidentName: 'Central Heatwave Response', name: 'Meal Packs', category: 'Food', unit: 'packs', quantity: 140, threshold: 90, location: 'Harbor Point', linkedNeedCategory: 'Food', organizationId: 'org-harbor' }),
    buildInventoryRecord({ id: 'inv-3', incidentId: 'incident-flood-02', incidentName: 'Westside Flood Recovery', name: 'Blankets', category: 'Shelter', unit: 'blankets', quantity: 32, threshold: 40, location: 'Westside Hub', linkedNeedCategory: 'Logistics', organizationId: 'org-central' }),
    buildInventoryRecord({ id: 'inv-4', incidentId: 'incident-flood-02', incidentName: 'Westside Flood Recovery', name: 'Learning Kits', category: 'Education', unit: 'kits', quantity: 18, threshold: 12, location: 'Westside', linkedNeedCategory: 'Education', organizationId: 'org-westside' })
  ],
  assignments: [
    {
      id: 'a1',
      needId: '1',
      volunteerId: 'v1',
      organizationId: 'org-central',
      organizationName: 'Central Relief Network',
      organizationShortName: 'CRN',
      status: 'accepted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'a2',
      needId: '2',
      volunteerId: 'v2',
      organizationId: 'org-westside',
      organizationName: 'Westside Learning Alliance',
      organizationShortName: 'WLA',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  networkRequests: [
    buildNetworkRequest({
      id: 'network-1',
      incidentId: 'incident-flood-02',
      incidentName: 'Westside Flood Recovery',
      type: 'inventory_support',
      status: 'requested',
      priority: 'high',
      summary: 'Westside Learning Alliance needs emergency blanket support from Central Relief Network.',
      detail: 'The network board identified low blanket inventory in Westside and available surplus at the central depot.',
      resourceCategory: 'Logistics',
      relatedInventoryItemId: 'inv-3',
      requestingOrganizationId: 'org-westside',
      supportingOrganizationId: 'org-central',
      suggestedUnits: 8,
      candidateCount: 1,
      transfer: {
        quantity: 8,
        unit: 'blankets',
        mode: 'van courier',
        supportingContact: 'CRN dispatch desk',
        receivingContact: 'WLA operations lead',
        handoffLocation: 'Westside Hub'
      }
    })
  ],
  marketplaceListings: [
    buildMarketplaceListing({
      id: 'listing-1',
      listingType: 'offer',
      resourceType: 'inventory',
      source: 'manual',
      title: 'Harbor meal pack surge support',
      detail: 'Harbor can release packaged meals for any partner facing food pressure this afternoon.',
      priority: 'high',
      resourceCategory: 'Food',
      quantity: 75,
      unit: 'packs',
      location: 'Harbor Point Warehouse',
      organizationId: 'org-harbor'
    }),
    buildMarketplaceListing({
      id: 'listing-2',
      listingType: 'request',
      resourceType: 'volunteer',
      source: 'manual',
      title: 'Westside requests education volunteers',
      detail: 'Westside needs trained volunteers for learning continuity support and child-safe engagement.',
      priority: 'high',
      resourceCategory: 'Education',
      quantity: 4,
      unit: 'volunteers',
      location: 'Westside Hub',
      organizationId: 'org-westside',
      certificationHints: ['Child Support Ally']
    })
  ],
  auditLogs: [
    {
      id: 'audit-1',
      action: 'system_initialized',
      entityType: 'platform',
      entityId: 'resourcesync',
      severity: 'info',
      summary: 'ResourceSync demo environment initialized with starter data.',
      actor: {
        uid: 'system',
        email: 'system@resourcesync.local',
        role: 'admin',
        source: 'system'
      },
      metadata: {
        mode: 'demo-seed'
      },
      createdAt: new Date().toISOString()
    }
    ,
    {
      id: 'audit-incident-1',
      incidentId: 'incident-heatwave-01',
      action: 'incident_briefing_created',
      entityType: 'incident',
      entityId: 'incident-heatwave-01',
      severity: 'high',
      summary: 'Leadership briefing opened for the active heatwave response.',
      actor: {
        uid: 'system',
        email: 'ops@resourcesync.local',
        role: 'admin',
        source: 'command-center'
      },
      metadata: {
        zone: 'Zone Alpha'
      },
      createdAt: new Date().toISOString()
    }
  ],
  dispatchLogs: [
    {
      id: 'dispatch-1',
      incidentId: 'incident-heatwave-01',
      channel: 'email',
      target: 'downtown-response@demo.local',
      summary: 'Simulation dispatched for Emergency Medical Supplies Sorting',
      status: 'delivered',
      createdAt: new Date().toISOString()
    }
  ],
  notifications: [
    {
      id: 'notif-1',
      incidentId: 'incident-heatwave-01',
      type: 'urgent_need',
      title: 'Critical need is active',
      message: 'Emergency Medical Supplies Sorting is currently marked as critical priority.',
      read: false,
      createdAt: new Date().toISOString()
    }
  ],
  reviewQueue: [],
  users: []
};

const memoryStore = JSON.parse(JSON.stringify(initialData));
let seedPromise = null;

function buildMongoQuery(id) {
  const stringId = String(id);
  const query = [{ id: stringId }];

  if (mongoose.Types.ObjectId.isValid(stringId)) {
    query.push({ _id: new mongoose.Types.ObjectId(stringId) });
  }

  return query.length === 1 ? query[0] : { $or: query };
}

function getMemoryCollection(collectionName) {
  return memoryStore[collectionName] || [];
}

async function ensureMongoSeeded() {
  if (!isMongoConfigured()) {
    return false;
  }

  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    const connected = await connectMongo();
    if (!connected) {
      return false;
    }

    try {
      const existingNeedCount = await models.needs.countDocuments();
      if (existingNeedCount > 0) {
        const existingOrganizationCount = await models.organizations.countDocuments();
        if (existingOrganizationCount === 0 && initialData.organizations.length) {
          await models.organizations.insertMany(initialData.organizations, { ordered: false });
        }
        return true;
      }

      for (const [collectionName, records] of Object.entries(initialData)) {
        if (!records.length) {
          continue;
        }

        await models[collectionName].insertMany(records, { ordered: false });
      }

      return true;
    } catch (error) {
      logMongoFallback(error, 'initial seed');
      return false;
    }
  })();

  return seedPromise;
}

async function useMongo() {
  if (!isMongoConfigured()) {
    return false;
  }

  return ensureMongoSeeded();
}

async function listCollection(collectionName) {
  if (!(await useMongo())) {
    return getMemoryCollection(collectionName).map((item) => applyCollectionDefaults(collectionName, { ...item }));
  }

  try {
    const docs = await models[collectionName].find({}).lean();
    return docs.map((doc) => applyCollectionDefaults(collectionName, normalizeMongoDoc(doc)));
  } catch (error) {
    logMongoFallback(error, `listing ${collectionName}`);
    return getMemoryCollection(collectionName).map((item) => applyCollectionDefaults(collectionName, { ...item }));
  }
}

async function getDocument(collectionName, id) {
  if (!(await useMongo())) {
    const item = getMemoryCollection(collectionName).find((entry) => String(entry.id) === String(id));
    return item ? applyCollectionDefaults(collectionName, { ...item }) : null;
  }

  try {
    const doc = await models[collectionName].findOne(buildMongoQuery(id)).lean();
    return doc ? applyCollectionDefaults(collectionName, normalizeMongoDoc(doc)) : null;
  } catch (error) {
    logMongoFallback(error, `reading ${collectionName}/${id}`);
    const item = getMemoryCollection(collectionName).find((entry) => String(entry.id) === String(id));
    return item ? applyCollectionDefaults(collectionName, { ...item }) : null;
  }
}

async function setDocument(collectionName, id, payload) {
  const normalized = { ...payload, id: String(id) };

  if (!(await useMongo())) {
    upsertMemory(collectionName, normalized);
    return normalized;
  }

  try {
    await models[collectionName].updateOne(buildMongoQuery(id), { $set: normalized }, { upsert: true, setDefaultsOnInsert: true });
    upsertMemory(collectionName, normalized);
    return normalized;
  } catch (error) {
    logMongoFallback(error, `writing ${collectionName}/${id}`);
    upsertMemory(collectionName, normalized);
    return normalized;
  }
}

async function updateDocument(collectionName, id, patch) {
  const existing = await getDocument(collectionName, id);
  if (!existing) {
    return null;
  }

  const updated = { ...existing, ...patch, id: String(id) };
  await setDocument(collectionName, id, updated);
  return updated;
}

async function deleteDocument(collectionName, id) {
  if (!(await useMongo())) {
    return deleteFromMemory(collectionName, id);
  }

  try {
    await models[collectionName].deleteOne(buildMongoQuery(id));
    deleteFromMemory(collectionName, id);
    return true;
  } catch (error) {
    logMongoFallback(error, `deleting ${collectionName}/${id}`);
    return deleteFromMemory(collectionName, id);
  }
}

async function getUserProfile(uid) {
  if (!(await useMongo())) {
    return getMemoryCollection('users').find((entry) => String(entry.uid) === String(uid)) || null;
  }

  try {
    const doc = await models.users.findOne({ uid: String(uid) }).lean();
    return doc ? normalizeMongoDoc(doc) : null;
  } catch (error) {
    logMongoFallback(error, `reading users/${uid}`);
    return getMemoryCollection('users').find((entry) => String(entry.uid) === String(uid)) || null;
  }
}

async function setUserProfile(uid, payload) {
  const existingProfile = await getUserProfile(uid);
  const existingTraining = existingProfile?.training || {};
  const existingMemberships = Array.isArray(existingProfile?.communityMemberships) ? existingProfile.communityMemberships : [];
  const existingBilling = existingProfile?.billing || {};
  const nextTraining = payload.training
    ? {
      completedCourses: payload.training.completedCourses || existingTraining.completedCourses || [],
      badges: payload.training.badges || existingTraining.badges || [],
      certificates: payload.training.certificates || existingTraining.certificates || [],
      attempts: payload.training.attempts || existingTraining.attempts || []
    }
    : (existingTraining.completedCourses || existingTraining.badges || existingTraining.certificates || existingTraining.attempts
      ? existingTraining
      : {
        completedCourses: [],
        badges: [],
        certificates: [],
        attempts: []
      });
  const nextBilling = payload.billing
    ? {
      planId: payload.billing.planId || existingBilling.planId || 'community',
      planName: payload.billing.planName || existingBilling.planName || 'Community',
      status: payload.billing.status || existingBilling.status || 'active',
      provider: payload.billing.provider || existingBilling.provider || 'mock',
      billingCycle: payload.billing.billingCycle || existingBilling.billingCycle || 'monthly',
      amount: Number(payload.billing.amount ?? existingBilling.amount) || 0,
      currency: payload.billing.currency || existingBilling.currency || 'USD',
      renewalDate: payload.billing.renewalDate || existingBilling.renewalDate || null,
      customerId: payload.billing.customerId || existingBilling.customerId || null,
      subscriptionId: payload.billing.subscriptionId || existingBilling.subscriptionId || null,
      checkoutHistory: Array.isArray(payload.billing.checkoutHistory) ? payload.billing.checkoutHistory : (existingBilling.checkoutHistory || []),
      paymentHistory: Array.isArray(payload.billing.paymentHistory) ? payload.billing.paymentHistory : (existingBilling.paymentHistory || [])
    }
    : {
      planId: existingBilling.planId || 'community',
      planName: existingBilling.planName || 'Community',
      status: existingBilling.status || 'active',
      provider: existingBilling.provider || 'mock',
      billingCycle: existingBilling.billingCycle || 'monthly',
      amount: Number(existingBilling.amount) || 0,
      currency: existingBilling.currency || 'USD',
      renewalDate: existingBilling.renewalDate || null,
      customerId: existingBilling.customerId || null,
      subscriptionId: existingBilling.subscriptionId || null,
      checkoutHistory: existingBilling.checkoutHistory || [],
      paymentHistory: existingBilling.paymentHistory || []
    };

  const normalized = {
    ...existingProfile,
    uid: String(uid),
    email: payload.email || existingProfile?.email || '',
    role: payload.role || existingProfile?.role || 'viewer',
    displayName: payload.displayName || existingProfile?.displayName || '',
    communityMemberships: Array.isArray(payload.communityMemberships) ? payload.communityMemberships : existingMemberships,
    billing: nextBilling,
    training: nextTraining,
    createdAt: existingProfile?.createdAt || payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!(await useMongo())) {
    upsertUserMemory(normalized);
    return normalized;
  }

  try {
    await models.users.updateOne({ uid: String(uid) }, normalized, { upsert: true, setDefaultsOnInsert: true });
    upsertUserMemory(normalized);
    return normalized;
  } catch (error) {
    logMongoFallback(error, `writing users/${uid}`);
    upsertUserMemory(normalized);
    return normalized;
  }
}

function upsertUserMemory(normalized) {
  const users = getMemoryCollection('users');
  const index = users.findIndex((entry) => String(entry.uid) === String(normalized.uid));
  if (index === -1) {
    users.push(normalized);
  } else {
    users[index] = { ...users[index], ...normalized };
  }
}

function upsertMemory(collectionName, payload) {
  const collection = getMemoryCollection(collectionName);
  const index = collection.findIndex((entry) => String(entry.id) === String(payload.id));
  if (index === -1) {
    collection.push(payload);
  } else {
    collection[index] = payload;
  }
}

function deleteFromMemory(collectionName, id) {
  const collection = getMemoryCollection(collectionName);
  const index = collection.findIndex((entry) => String(entry.id) === String(id));
  if (index === -1) {
    return false;
  }
  collection.splice(index, 1);
  return true;
}

function normalizeMongoDoc(doc) {
  if (!doc) {
    return doc;
  }

  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: rest.id || (_id ? String(_id) : undefined)
  };
}

function applyCollectionDefaults(collectionName, item) {
  if (!item) {
    return item;
  }

  if (collectionName === 'needs') {
    const organization = getOrganizationMeta(item.organizationId);
    return {
      ...item,
      incidentId: item.incidentId || null,
      incidentName: item.incidentName || null,
      organizationId: item.organizationId || organization.id,
      organizationName: item.organizationName || organization.name,
      organizationShortName: item.organizationShortName || organization.shortName
    };
  }

  if (collectionName === 'assignments') {
    const organization = getOrganizationMeta(item.organizationId);
    return {
      ...item,
      organizationId: item.organizationId || organization.id,
      organizationName: item.organizationName || organization.name,
      organizationShortName: item.organizationShortName || organization.shortName
    };
  }

  if (collectionName === 'inventory' || collectionName === 'reviewQueue') {
    const organization = getOrganizationMeta(item.organizationId);
    return {
      ...item,
      incidentId: item.incidentId || null,
      incidentName: item.incidentName || null,
      organizationId: item.organizationId || organization.id,
      organizationName: item.organizationName || organization.name,
      organizationShortName: item.organizationShortName || organization.shortName
    };
  }

  if (collectionName === 'networkRequests') {
    const requestingOrganization = getOrganizationMeta(item.requestingOrganizationId);
    const supportingOrganization = getOrganizationMeta(item.supportingOrganizationId);

    return {
      ...item,
      incidentId: item.incidentId || null,
      incidentName: item.incidentName || null,
      requestingOrganizationId: item.requestingOrganizationId || requestingOrganization.id,
      requestingOrganizationName: item.requestingOrganizationName || requestingOrganization.name,
      requestingOrganizationShortName: item.requestingOrganizationShortName || requestingOrganization.shortName,
      supportingOrganizationId: item.supportingOrganizationId || supportingOrganization.id,
      supportingOrganizationName: item.supportingOrganizationName || supportingOrganization.name,
      supportingOrganizationShortName: item.supportingOrganizationShortName || supportingOrganization.shortName,
      transfer: {
        quantity: Number(item.transfer?.quantity ?? item.suggestedUnits) || 0,
        unit: item.transfer?.unit || 'units',
        mode: item.transfer?.mode || '',
        eta: item.transfer?.eta || '',
        supportingContact: item.transfer?.supportingContact || '',
        receivingContact: item.transfer?.receivingContact || '',
        handoffLocation: item.transfer?.handoffLocation || '',
        notes: item.transfer?.notes || ''
      },
      approvals: {
        requesterConfirmedAt: item.approvals?.requesterConfirmedAt || item.createdAt || new Date().toISOString(),
        requesterConfirmedBy: item.approvals?.requesterConfirmedBy || item.createdBy || null,
        supportingApprovedAt: item.approvals?.supportingApprovedAt || null,
        supportingApprovedBy: item.approvals?.supportingApprovedBy || null,
        deliveryConfirmedAt: item.approvals?.deliveryConfirmedAt || null,
        deliveryConfirmedBy: item.approvals?.deliveryConfirmedBy || null,
        receiptVerifiedAt: item.approvals?.receiptVerifiedAt || null,
        receiptVerifiedBy: item.approvals?.receiptVerifiedBy || null,
        closedAt: item.approvals?.closedAt || null,
        closedBy: item.approvals?.closedBy || null
      },
      verification: {
        receiptNote: item.verification?.receiptNote || '',
        evidenceSummary: item.verification?.evidenceSummary || '',
        impactSummary: item.verification?.impactSummary || '',
        beneficiaryDelta: Number(item.verification?.beneficiaryDelta) || 0
      },
      execution: {
        volunteerAssignmentsCreated: Array.isArray(item.execution?.volunteerAssignmentsCreated) ? item.execution.volunteerAssignmentsCreated : [],
        inventoryTransfersApplied: Array.isArray(item.execution?.inventoryTransfersApplied) ? item.execution.inventoryTransfersApplied : [],
        effectsAppliedAt: item.execution?.effectsAppliedAt || null
      },
      history: Array.isArray(item.history) ? item.history : []
    };
  }

  if (collectionName === 'marketplaceListings') {
    const organization = getOrganizationMeta(item.organizationId);

    return {
      ...item,
      listingType: item.listingType || 'offer',
      resourceType: item.resourceType || 'inventory',
      status: item.status || 'open',
      source: item.source || 'manual',
      title: item.title || 'Marketplace listing',
      detail: item.detail || '',
      priority: item.priority || 'watch',
      resourceCategory: item.resourceCategory || 'General',
      quantity: Number(item.quantity) || 0,
      unit: item.unit || 'units',
      location: item.location || 'Network hub',
      organizationId: item.organizationId || organization.id,
      organizationName: item.organizationName || organization.name,
      organizationShortName: item.organizationShortName || organization.shortName,
      targetOrganizationId: item.targetOrganizationId || null,
      inventoryItemId: item.inventoryItemId || null,
      volunteerIds: Array.isArray(item.volunteerIds) ? item.volunteerIds : [],
      certificationHints: Array.isArray(item.certificationHints) ? item.certificationHints : [],
      linkedNeedId: item.linkedNeedId || null,
      linkedNetworkRequestId: item.linkedNetworkRequestId || null,
      matchedOrganizationId: item.matchedOrganizationId || null,
      metadata: item.metadata || {},
      convertedAt: item.convertedAt || null
    };
  }

  return item;
}

module.exports = {
  organizationCatalog,
  getOrganizationMeta,
  badgeForVolunteer,
  buildIncidentRecord,
  buildNeedRecord,
  buildInventoryRecord,
  buildMarketplaceListing,
  buildNetworkRequest,
  buildReviewItem,
  deleteDocument,
  enrichVolunteer,
  getDocument,
  getUserProfile,
  inferCoordinates,
  listCollection,
  setDocument,
  setUserProfile,
  updateDocument
};
