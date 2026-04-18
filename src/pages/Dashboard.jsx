import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Camera, ClipboardCheck, Clock, Eye, MapPin, RefreshCw, ShieldCheck, TrendingUp, Upload, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import CrisisMap from '../components/CrisisMap';
import DispatchFeed from '../components/DispatchFeed';
import Leaderboard from '../components/Leaderboard';
import NotificationsPanel from '../components/NotificationsPanel';
import { roleDefinitions, useAuth } from '../contexts/AuthContext';
import { deleteJson, getJson, normalizeArray, patchJson, postJson } from '../utils/api';

const languageOptions = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'hi', label: 'Hindi' }
];

const assignmentStatuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'en_route', label: 'En Route' },
  { value: 'completed', label: 'Completed' }
];

const dashboardCopy = {
  en: {
    title: 'Mission Control Overview',
    subtitle: 'Real-time telemetry of community resources and urgent tasks.',
    refresh: 'Refresh Data',
    needsHeading: 'Urgent Community Needs',
    addNeed: '+ Log New Need',
    intelligenceTitle: 'System Intelligence',
    intelligenceBody: 'Our Gemini API allocation algorithm is constantly evaluating optimal distributions.',
    analysis: 'Analysis Report',
    noNeeds: 'No active needs logged yet.',
    findMatch: 'Find Match',
    finding: 'Finding...',
    volunteersNeeded: 'Volunteers Needed'
  },
  es: {
    title: 'Centro de Mando',
    subtitle: 'Telemetria en tiempo real de recursos comunitarios y tareas urgentes.',
    refresh: 'Actualizar',
    needsHeading: 'Necesidades Urgentes',
    addNeed: '+ Registrar Necesidad',
    intelligenceTitle: 'Inteligencia del Sistema',
    intelligenceBody: 'El motor Gemini evalua distribuciones optimas constantemente.',
    analysis: 'Informe de Analisis',
    noNeeds: 'Todavia no hay necesidades activas.',
    findMatch: 'Buscar Coincidencia',
    finding: 'Buscando...',
    volunteersNeeded: 'Voluntarios Necesarios'
  },
  fr: {
    title: 'Centre de Mission',
    subtitle: 'Vue en temps reel des ressources communautaires et des urgences.',
    refresh: 'Actualiser',
    needsHeading: 'Besoins Urgents',
    addNeed: '+ Ajouter un Besoin',
    intelligenceTitle: 'Intelligence Systeme',
    intelligenceBody: 'Le moteur Gemini evalue en continu les meilleures allocations.',
    analysis: 'Rapport d Analyse',
    noNeeds: 'Aucun besoin actif pour le moment.',
    findMatch: 'Trouver un Benevole',
    finding: 'Recherche...',
    volunteersNeeded: 'Volontaires Requis'
  },
  hi: {
    title: 'Mission Control Overview',
    subtitle: 'Community resources aur urgent tasks ka live view.',
    refresh: 'Refresh Data',
    needsHeading: 'Urgent Community Needs',
    addNeed: '+ Log New Need',
    intelligenceTitle: 'System Intelligence',
    intelligenceBody: 'Gemini engine lagatar best allocation evaluate kar raha hai.',
    analysis: 'Analysis Report',
    noNeeds: 'Abhi koi active need nahi hai.',
    findMatch: 'Find Match',
    finding: 'Finding...',
    volunteersNeeded: 'Volunteers Needed'
  }
};

const roleExperience = {
  admin: {
    title: 'Executive Operations Console',
    subtitle: 'Full mission visibility with decision authority across approvals, assignments, and system oversight.',
    icon: ShieldCheck,
    accent: 'var(--accent-cyan)',
    focusLabel: 'Admin Focus',
    focusText: 'Keep the system healthy, watch approval pressure, and intervene when low-value or duplicate needs should be removed.',
    primaryAction: { label: 'Open Approval Queue', route: '/approval-queue' },
    secondaryAction: { label: 'Review Analytics', route: '/analytics' }
  },
  coordinator: {
    title: 'Coordination Workbench',
    subtitle: 'Prioritize urgent needs, move assignments forward, and keep operational throughput moving.',
    icon: ClipboardCheck,
    accent: 'var(--accent-purple)',
    focusLabel: 'Coordinator Focus',
    focusText: 'Your dashboard is optimized around approvals, assignment coverage, and rapid action on unresolved community needs.',
    primaryAction: { label: 'Manage Intake Queue', route: '/approval-queue' },
    secondaryAction: { label: 'Log New Need', route: '/intake' }
  },
  field_volunteer: {
    title: 'Field Volunteer View',
    subtitle: 'Monitor mission activity, track active assignments, and understand where support is most urgently needed.',
    icon: Users,
    accent: 'var(--accent-green)',
    focusLabel: 'Field Focus',
    focusText: 'You see the clearest operational picture for on-the-ground action: urgent needs, live alerts, and volunteer momentum.',
    primaryAction: { label: 'Open Volunteer Portal', route: '/volunteer' },
    secondaryAction: { label: 'View Transparency', route: '/transparency' }
  },
  viewer: {
    title: 'Stakeholder Briefing View',
    subtitle: 'A read-only operational story designed for judges, donors, and leadership walkthroughs.',
    icon: Eye,
    accent: 'var(--accent-orange)',
    focusLabel: 'Viewer Focus',
    focusText: 'This experience emphasizes clarity over control so you can understand system activity without changing live response data.',
    primaryAction: { label: 'Open Transparency Page', route: '/transparency' },
    secondaryAction: { label: 'View Analytics', route: '/analytics' }
  }
};

const ORGANIZATION_SCOPE_STORAGE_KEY = 'resourcesync_selected_organization';

export default function Dashboard() {
  const { currentUser, getToken, hasPermission, updateRole } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [networkOverview, setNetworkOverview] = useState({ organizations: [], opportunities: [], requests: [] });
  const [inventory, setInventory] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() => {
    if (typeof window === 'undefined') {
      return 'all';
    }

    return window.localStorage.getItem(ORGANIZATION_SCOPE_STORAGE_KEY) || 'all';
  });
  const [operationsInsights, setOperationsInsights] = useState({ predictiveInsights: { categories: [], hotspots: [], headline: '' }, inventoryPressure: [], sdgImpact: [], summary: {} });
  const [insight, setInsight] = useState('Initializing intelligence engine...');
  const [loading, setLoading] = useState(true);
  const [matchingTaskId, setMatchingTaskId] = useState(null);
  const [language, setLanguage] = useState('en');
  const [certificationFilter, setCertificationFilter] = useState('all');
  const [selectedVolunteerByTask, setSelectedVolunteerByTask] = useState({});
  const [assigningTaskId, setAssigningTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [markingNotificationId, setMarkingNotificationId] = useState(null);
  const [acknowledgingEscalationId, setAcknowledgingEscalationId] = useState(null);
  const [outcomeDrafts, setOutcomeDrafts] = useState({});
  const [updatingOutcomeId, setUpdatingOutcomeId] = useState(null);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [evidenceDrafts, setEvidenceDrafts] = useState({});
  const [uploadingEvidenceId, setUploadingEvidenceId] = useState(null);
  const [verifyingAssignmentId, setVerifyingAssignmentId] = useState(null);
  const [creatingNetworkRequestId, setCreatingNetworkRequestId] = useState(null);
  const [updatingNetworkRequestId, setUpdatingNetworkRequestId] = useState(null);

  const copy = dashboardCopy[language] || dashboardCopy.en;
  const currentRole = currentUser?.role || 'viewer';
  const roleMeta = roleExperience[currentRole] || roleExperience.viewer;
  const RoleIcon = roleMeta.icon;
  const canManageAssignments = hasPermission('assignment_manage');
  const canDeleteNeeds = currentRole === 'admin';
  const canReviewIntake = hasPermission('intake_review');
  const canAcknowledgeEscalations = ['admin', 'coordinator'].includes(currentRole);
  const canUseNetworkView = ['admin', 'coordinator'].includes(currentRole);
  const canUploadEvidence = Boolean(currentUser) && currentRole !== 'viewer';
  const canVerifyCompletion = canManageAssignments;
  const totalAssignments = tasks.reduce((sum, task) => sum + (task.currentAssignments?.length || 0), 0);
  const volunteerHours = volunteers.reduce((sum, volunteer) => sum + (volunteer.hoursVolunteered || 0), 0);
  const averageReliability = volunteers.length
    ? Math.round(volunteers.reduce((sum, volunteer) => sum + Number(volunteer.reliabilityScore || 0), 0) / volunteers.length)
    : 0;
  const verifiedCompletionCount = volunteers.reduce((sum, volunteer) => sum + Number(volunteer.verifiedCompletions || 0), 0);
  const evidenceBackedCount = volunteers.reduce((sum, volunteer) => sum + Number(volunteer.evidenceBackedVerifications || 0), 0);
  const completedAssignments = tasks.reduce(
    (sum, task) => sum + ((task.currentAssignments || []).filter((assignment) => assignment.status === 'completed').length),
    0
  );
  const pendingAssignments = tasks.reduce(
    (sum, task) => sum + ((task.currentAssignments || []).filter((assignment) => assignment.status !== 'completed').length),
    0
  );
  const criticalNeeds = tasks.filter((task) => task.urgency === 'Critical').length;
  const coverageGap = tasks.reduce((sum, task) => sum + (task.openSpots || 0), 0);
  const escalatedCount = escalations.filter((task) => task.escalation?.status === 'escalated').length;
  const lowInventoryCount = inventory.filter((item) => item.status === 'low').length;
  const activeTaskAssignments = tasks.flatMap((task) => (task.currentAssignments || []).map((assignment) => ({
    ...assignment,
    taskTitle: task.translatedTitle || task.title,
    urgency: task.translatedUrgency || task.urgency
  })));
  const myRecommendedTasks = useMemo(() => {
    if (currentRole !== 'field_volunteer') {
      return [];
    }

    return tasks
      .filter((task) => volunteers.some((volunteer) => volunteer.skill === task.category))
      .slice(0, 4);
  }, [currentRole, tasks, volunteers]);
  const certificationOptions = useMemo(
    () => Array.from(new Set(volunteers.flatMap((volunteer) => volunteer.certifications || []))).sort(),
    [volunteers]
  );
  const viewerHighlights = useMemo(() => tasks.slice(0, 3), [tasks]);
  const showNetworkBoard = canUseNetworkView && selectedOrganizationId === 'all';
  const selectedOrganization = useMemo(() => {
    if (selectedOrganizationId === 'all') {
      return {
        id: 'all',
        name: 'All organizations',
        shortName: 'NET',
        accent: 'var(--accent-cyan)'
      };
    }

    return organizations.find((organization) => String(organization.id) === String(selectedOrganizationId)) || null;
  }, [organizations, selectedOrganizationId]);
  const networkOrganizations = Array.isArray(networkOverview.organizations) ? networkOverview.organizations : [];
  const networkOpportunities = Array.isArray(networkOverview.opportunities) ? networkOverview.opportunities : [];
  const networkRequests = Array.isArray(networkOverview.requests) ? networkOverview.requests : [];
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((left, right) => {
      const scoreGap = Number(right.escalation?.score || 0) - Number(left.escalation?.score || 0);
      if (scoreGap !== 0) {
        return scoreGap;
      }

      const urgencyOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return (urgencyOrder[right.urgency] || 0) - (urgencyOrder[left.urgency] || 0);
    });
  }, [tasks]);
  const passportChampion = useMemo(() => {
    return [...volunteers]
      .sort((left, right) => {
        const reliabilityGap = Number(right.reliabilityScore || 0) - Number(left.reliabilityScore || 0);
        if (reliabilityGap !== 0) {
          return reliabilityGap;
        }

        return Number(right.verifiedCompletions || 0) - Number(left.verifiedCompletions || 0);
      })[0] || null;
  }, [volunteers]);
  const roleStats = {
    admin: [
      { label: 'Critical Needs', value: criticalNeeds, icon: <AlertCircle size={24} color="var(--accent-red)" />, trend: 'Executive escalation watch' },
      { label: 'Escalations', value: escalatedCount, icon: <Zap size={24} color="var(--accent-orange)" />, trend: 'Needs waiting for human intervention' },
      { label: 'Pending Approvals', value: notifications.filter((n) => n.type === 'review_queue' && !n.read).length, icon: <ClipboardCheck size={24} color="var(--accent-purple)" />, trend: 'Review queue pressure' },
      { label: 'Coverage Gap', value: coverageGap, icon: <Users size={24} color="var(--accent-cyan)" />, trend: 'Open volunteer slots remaining' }
    ],
    coordinator: [
      { label: 'Active Requests', value: tasks.length, icon: <AlertCircle size={24} color="var(--accent-pink)" />, trend: 'Updated just now' },
      { label: 'Assignments In Flight', value: pendingAssignments, icon: <Users size={24} color="var(--accent-cyan)" />, trend: 'Operational workload in motion' },
      { label: 'Critical Cases', value: criticalNeeds, icon: <Clock size={24} color="var(--accent-orange)" />, trend: 'Immediate coordinator attention' },
      { label: 'Escalations', value: escalatedCount, icon: <Zap size={24} color="var(--accent-purple)" />, trend: 'Needs that require coordinator review' }
    ],
    field_volunteer: [
      { label: 'Urgent Needs Nearby', value: criticalNeeds, icon: <AlertCircle size={24} color="var(--accent-orange)" />, trend: 'High-priority missions visible' },
      { label: 'Assignments Active', value: pendingAssignments, icon: <Users size={24} color="var(--accent-cyan)" />, trend: 'Current field workload' },
      { label: 'Completed Missions', value: completedAssignments, icon: <TrendingUp size={24} color="var(--accent-green)" />, trend: 'Volunteer impact delivered' },
      { label: 'System Alerts', value: notifications.length, icon: <Zap size={24} color="var(--accent-purple)" />, trend: 'Stay aware of live changes' }
    ],
    viewer: [
      { label: 'Active Requests', value: tasks.length, icon: <AlertCircle size={24} color="var(--accent-pink)" />, trend: 'Public-facing demand signal' },
      { label: 'Volunteers Assigned', value: totalAssignments, icon: <Users size={24} color="var(--accent-cyan)" />, trend: 'Visible response coverage' },
      { label: 'Avg Time to Match', value: '4.2 hrs', icon: <Clock size={24} color="var(--accent-purple)" />, trend: 'Response speed trend' },
      { label: 'Volunteer Hours', value: `${volunteerHours} hrs`, icon: <TrendingUp size={24} color="var(--accent-green)" />, trend: 'Cumulative community effort' }
    ]
  };

  const handleRoleSwitch = async (nextRole) => {
    if (!nextRole || nextRole === currentRole) {
      return;
    }

    setSwitchingRole(true);
    try {
      await updateRole(nextRole);
      setInsight(`Dashboard role switched to ${roleDefinitions[nextRole]?.label || nextRole}. The page now reflects that experience.`);
    } catch (error) {
      console.error(error);
      setInsight(`Role switch failed. ${error.message}`);
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleOrganizationSwitch = (nextOrganizationId) => {
    setSelectedOrganizationId(nextOrganizationId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ORGANIZATION_SCOPE_STORAGE_KEY, nextOrganizationId);
    }
  };

  const fetchData = async (selectedLanguage = language, organizationId = selectedOrganizationId) => {
    setLoading(true);
    try {
      const token = currentUser ? await getToken().catch(() => null) : null;
      const organizationQuery = buildOrganizationQuery(organizationId);
      const [needData, volunteerData, dispatchData, matchData, notificationsData, escalationsData, inventoryData, insightsData, networkOverviewData, organizationsData] = await Promise.all([
        getJson(`/api/needs?lang=${encodeURIComponent(selectedLanguage)}${organizationQuery ? `&${organizationQuery.slice(1)}` : ''}`),
        getJson(`/api/volunteers${organizationQuery}`),
        getJson('/api/dispatch-logs'),
        getJson(`/api/matches${organizationQuery}`),
        getJson('/api/notifications'),
        token ? getJson(`/api/escalations${organizationQuery}`, { token }) : Promise.resolve([]),
        getJson('/api/inventory'),
        token ? getJson('/api/insights/operations', { token }).catch(() => ({ success: false })) : Promise.resolve({ success: false }),
        getJson(`/api/network/overview${organizationQuery}`).catch(() => ({ success: false })),
        getJson('/api/organizations')
      ]);

      const safeNeeds = normalizeArray(needData);
      const safeVolunteers = normalizeArray(volunteerData);
      const safeDispatchLogs = normalizeArray(dispatchData);
      const safeNotifications = normalizeArray(notificationsData);
      const safeEscalations = normalizeArray(escalationsData);
      const safeInventory = normalizeArray(inventoryData);
      const safeOrganizations = normalizeArray(organizationsData);

      setTasks(safeNeeds);
      setVolunteers(safeVolunteers);
      setOrganizations(safeOrganizations);
      setDispatchLogs(safeDispatchLogs.slice(0, 6));
      setNotifications(safeNotifications.slice(0, 8));
      setEscalations(safeEscalations);
      setInventory(safeInventory);
      setNetworkOverview(networkOverviewData?.success ? {
        organizations: Array.isArray(networkOverviewData.organizations) ? networkOverviewData.organizations : [],
        opportunities: Array.isArray(networkOverviewData.opportunities) ? networkOverviewData.opportunities : [],
        requests: Array.isArray(networkOverviewData.requests) ? networkOverviewData.requests : []
      } : { organizations: [], opportunities: [], requests: [] });
      setOperationsInsights(insightsData?.success ? insightsData : { predictiveInsights: { categories: [], hotspots: [], headline: '' }, inventoryPressure: [], sdgImpact: [], summary: {} });
      setSelectedVolunteerByTask((current) => buildSelectionState(safeNeeds, safeVolunteers, current, certificationFilter));
      setOutcomeDrafts((current) => buildOutcomeDrafts(safeNeeds, current));
      setEvidenceDrafts((current) => buildEvidenceDrafts(safeNeeds, current));

      if (matchData.success) {
        setInsight(matchData.aiInsight);
      } else {
        setInsight(matchData.error || 'AI Evaluation currently offline.');
      }
    } catch (err) {
      console.error(err);
      setTasks([]);
      setVolunteers([]);
      setDispatchLogs([]);
      setNotifications([]);
      setEscalations([]);
      setInventory([]);
      setNetworkOverview({ organizations: [], opportunities: [], requests: [] });
      setOperationsInsights({ predictiveInsights: { categories: [], hotspots: [], headline: '' }, inventoryPressure: [], sdgImpact: [], summary: {} });
      setInsight('Unable to connect to intelligence engine.');
    } finally {
      setLoading(false);
    }
  };

  const handleOutcomeUpdate = async (task) => {
    const draft = outcomeDrafts[task.id] || { status: task.outcome?.status || 'open', beneficiaryCount: task.outcome?.beneficiaryCount || 0, summary: task.outcome?.summary || '' };
    setUpdatingOutcomeId(task.id);

    try {
      const token = await getToken();
      await patchJson(`/api/needs/${encodeURIComponent(task.id)}/outcome`, draft, { token });
      setInsight(`Outcome updated for "${task.translatedTitle || task.title}". Status is now ${draft.status}.`);
      await fetchData(language);
    } catch (error) {
      console.error(error);
      setInsight(`Outcome update failed. ${error.message}`);
    } finally {
      setUpdatingOutcomeId(null);
    }
  };

  const handleAcknowledgeEscalation = async (task) => {
    setAcknowledgingEscalationId(task.id);

    try {
      const token = await getToken();
      await patchJson(`/api/escalations/${encodeURIComponent(task.id)}/acknowledge`, {}, { token });

      setInsight(`Escalation acknowledged for "${task.translatedTitle || task.title}". The item remains visible until coverage improves.`);
      await fetchData(language);
    } catch (error) {
      console.error(error);
      setInsight(`Escalation acknowledgement failed. ${error.message}`);
    } finally {
      setAcknowledgingEscalationId(null);
    }
  };

  const markNotificationsRead = async (id) => {
    setMarkingNotificationId(id || 'all');

    try {
      const token = await getToken();
      const data = await patchJson('/api/notifications/read', id ? { id } : {}, { token });

      setNotifications(normalizeArray(data.notifications).slice(0, 8));
    } catch (error) {
      console.error(error);
      setInsight(`Notification update failed. ${error.message}`);
    } finally {
      setMarkingNotificationId(null);
    }
  };

  useEffect(() => {
    fetchData(language, selectedOrganizationId);
  }, [language, currentUser?.uid, selectedOrganizationId]);

  useEffect(() => {
    setSelectedVolunteerByTask((current) => buildSelectionState(tasks, volunteers, current, certificationFilter));
  }, [certificationFilter, tasks, volunteers]);

  useEffect(() => {
    const handleExternalRefresh = () => {
      fetchData(language);
    };

    window.addEventListener('resourcesync:data-changed', handleExternalRefresh);
    return () => window.removeEventListener('resourcesync:data-changed', handleExternalRefresh);
  }, [language, currentUser?.uid]);

  const handleFindMatch = async (task) => {
    setMatchingTaskId(task.id);
    setInsight(`Scanning volunteers for "${task.translatedTitle || task.title}"...`);

    try {
      const matchData = await getJson(`/api/matches?needId=${encodeURIComponent(task.id)}`);

      const recommendation = Array.isArray(matchData.recommendations)
        ? matchData.recommendations.find((entry) => String(entry.needId) === String(task.id))
        : null;
      const topVolunteer = recommendation?.volunteers?.[0];

      if (topVolunteer?.id) {
        setSelectedVolunteerByTask((current) => ({
          ...current,
          [task.id]: String(topVolunteer.id)
        }));
      }

      setInsight(
        topVolunteer
          ? `${matchData.aiInsight}\n\nRecommended volunteer selected: ${topVolunteer.name} (${topVolunteer.skill}, ${topVolunteer.location}).`
          : matchData.aiInsight
      );
    } catch (err) {
      console.error(err);
      setInsight(`Match lookup failed for "${task.title}". ${err.message}`);
    } finally {
      setMatchingTaskId(null);
    }
  };

  const handleAssignVolunteer = async (task) => {
    const volunteerId = selectedVolunteerByTask[task.id];
    if (!volunteerId) {
      setInsight(`Choose a volunteer before assigning work for "${task.title}".`);
      return;
    }

    const selectedVolunteer = volunteers.find((entry) => String(entry.id) === String(volunteerId));
    if (task.requiredBadge && !(selectedVolunteer?.certifications || []).includes(task.requiredBadge)) {
      setInsight(`Assignment blocked. ${selectedVolunteer?.name || 'Selected volunteer'} does not hold the required badge: ${task.requiredBadge}.`);
      return;
    }

    setAssigningTaskId(task.id);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Your session is missing an auth token. Please sign in again and retry.');
      }

      const data = await postJson('/api/assignments', {
        needId: task.id,
        volunteerId
      }, { token });

      setInsight(`Assignment created: ${data.assignment.volunteerName} is now linked to "${task.title}".`);
      await fetchData(language);
    } catch (error) {
      console.error(error);
      setInsight(`Assignment failed for "${task.title}". ${error.message}`);
    } finally {
      setAssigningTaskId(null);
    }
  };

  const handleAssignmentStatusChange = async (assignmentId, nextStatus) => {
    setStatusUpdatingId(assignmentId);

    try {
      const token = await getToken();
      const data = await patchJson(`/api/assignments/${encodeURIComponent(assignmentId)}/status`, { status: nextStatus }, { token });

      setInsight(`Assignment updated: ${data.assignment.volunteerName} is now ${data.assignment.statusLabel.toLowerCase()}.`);
      await fetchData(language);
    } catch (error) {
      console.error(error);
      setInsight(`Status update failed. ${error.message}`);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDeleteNeed = async (task) => {
    const confirmed = window.confirm(`Delete "${task.translatedTitle || task.title}" from Mission Control?`);
    if (!confirmed) {
      return;
    }

    setDeletingTaskId(task.id);

    try {
      const token = await getToken();
      await deleteJson(`/api/needs/${encodeURIComponent(task.id)}`, { token });

      await fetchData(language);
      setInsight(`Need removed: "${task.translatedTitle || task.title}" has been deleted by admin review.`);
    } catch (error) {
      console.error(error);
      setInsight(`Delete failed for "${task.translatedTitle || task.title}". ${error.message}`);
    } finally {
      setDeletingTaskId(null);
    }
  };

  const handleEvidenceFileChange = async (assignmentId, file) => {
    if (!file) {
      setEvidenceDrafts((current) => ({
        ...current,
        [assignmentId]: {
          ...(current[assignmentId] || {}),
          file: null,
          fileName: '',
          mimeType: '',
          imageData: ''
        }
      }));
      return;
    }

    try {
      const { imageData, mimeType } = await fileToDataUrl(file);
      setEvidenceDrafts((current) => ({
        ...current,
        [assignmentId]: {
          ...(current[assignmentId] || {}),
          file,
          fileName: file.name,
          mimeType,
          imageData
        }
      }));
    } catch (error) {
      console.error(error);
      setInsight(`Evidence preparation failed. ${error.message}`);
    }
  };

  const handleEvidenceNotesChange = (assignmentId, notes) => {
    setEvidenceDrafts((current) => ({
      ...current,
      [assignmentId]: {
        ...(current[assignmentId] || {}),
        notes
      }
    }));
  };

  const handleUploadEvidence = async (task, assignment) => {
    const draft = evidenceDrafts[assignment.id];
    if (!draft?.imageData || !draft?.fileName) {
      setInsight(`Choose an image before uploading field evidence for ${assignment.volunteerName}.`);
      return;
    }

    setUploadingEvidenceId(assignment.id);

    try {
      const token = await getToken();
      await postJson(`/api/assignments/${encodeURIComponent(assignment.id)}/evidence`, {
        fileName: draft.fileName,
        mimeType: draft.mimeType,
        imageData: draft.imageData,
        notes: draft.notes || ''
      }, { token, timeoutMs: 30000 });

      setInsight(`Field evidence uploaded for ${assignment.volunteerName} on "${task.translatedTitle || task.title}".`);
      setEvidenceDrafts((current) => ({
        ...current,
        [assignment.id]: {
          file: null,
          fileName: '',
          mimeType: '',
          imageData: '',
          notes: ''
        }
      }));
      await fetchData(language);
    } catch (error) {
      console.error(error);
      setInsight(`Evidence upload failed. ${error.message}`);
    } finally {
      setUploadingEvidenceId(null);
    }
  };

  const handleVerifyCompletion = async (task, assignment) => {
    setVerifyingAssignmentId(assignment.id);

    try {
      const token = await getToken();
      await patchJson(`/api/assignments/${encodeURIComponent(assignment.id)}/verify`, {}, { token });

      setInsight(`Verified completion recorded for ${assignment.volunteerName} on "${task.translatedTitle || task.title}". Reward bonus and reliability score have been updated.`);
      await fetchData(language);
    } catch (error) {
      console.error(error);
      setInsight(`Verification failed. ${error.message}`);
    } finally {
      setVerifyingAssignmentId(null);
    }
  };

  const handleCreateNetworkRequest = async (opportunity) => {
    setCreatingNetworkRequestId(opportunity.id);

    try {
      const token = await getToken();
      await postJson('/api/network/requests', {
        type: opportunity.type,
        priority: opportunity.priority,
        summary: opportunity.summary,
        detail: opportunity.detail,
        resourceCategory: opportunity.resourceCategory,
        relatedNeedId: opportunity.relatedNeedId || null,
        relatedInventoryItemId: opportunity.relatedInventoryItemId || null,
        requestingOrganizationId: opportunity.requestingOrganizationId,
        requestingOrganizationName: opportunity.requestingOrganizationName,
        requestingOrganizationShortName: opportunity.requestingOrganizationShortName,
        supportingOrganizationId: opportunity.supportingOrganizationId,
        supportingOrganizationName: opportunity.supportingOrganizationName,
        supportingOrganizationShortName: opportunity.supportingOrganizationShortName,
        suggestedUnits: opportunity.suggestedUnits,
        candidateCount: opportunity.candidateCount,
        recommendedVolunteerIds: opportunity.recommendedVolunteerIds || [],
        recommendedInventoryItemIds: opportunity.recommendedInventoryItemIds || []
      }, { token });

      setInsight(`Mutual aid request created. ${opportunity.supportingOrganizationShortName || opportunity.supportingOrganizationName} is now queued to support ${opportunity.requestingOrganizationShortName || opportunity.requestingOrganizationName}.`);
      await fetchData(language, selectedOrganizationId);
    } catch (error) {
      console.error(error);
      setInsight(`Network request creation failed. ${error.message}`);
    } finally {
      setCreatingNetworkRequestId(null);
    }
  };

  const handleNetworkRequestStatusChange = async (request, nextStatus) => {
    setUpdatingNetworkRequestId(request.id);

    try {
      const token = await getToken();
      await patchJson(`/api/network/requests/${encodeURIComponent(request.id)}/status`, { status: nextStatus }, { token });

      setInsight(`Mutual aid request updated. ${request.requestingOrganizationShortName || request.requestingOrganizationName} to ${request.supportingOrganizationShortName || request.supportingOrganizationName} is now ${formatNetworkRequestStatus(nextStatus).toLowerCase()}.`);
      await fetchData(language, selectedOrganizationId);
    } catch (error) {
      console.error(error);
      setInsight(`Network request update failed. ${error.message}`);
    } finally {
      setUpdatingNetworkRequestId(null);
    }
  };

  const renderUrgencyBadge = (task) => {
    const urgency = task.urgency;
    let bgStyle;
    if (urgency === 'Critical') {
      bgStyle = 'linear-gradient(135deg, #ff3b30, #ff9500)';
    } else if (urgency === 'High') {
      bgStyle = 'linear-gradient(135deg, #ff9500, #ffd60a)';
    } else {
      bgStyle = 'linear-gradient(135deg, #00C6FF, #0072FF)';
    }

    return (
      <span
        style={{
          background: bgStyle,
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '0.8rem',
          fontWeight: '600',
          color: '#fff'
        }}
      >
        {task.translatedUrgency || task.urgency}
      </span>
    );
  };

  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div className="dashboard-container page-shell page-shell--wide" style={{ display: 'grid', gap: '2rem' }}>
      <section
        className="glass-panel"
        style={{
          padding: '1.8rem',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
          gap: '1.5rem',
          background: `linear-gradient(140deg, color-mix(in srgb, ${roleMeta.accent} 9%, transparent), rgba(8,12,20,0.88) 48%, rgba(255,255,255,0.02))`
        }}
      >
        <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
            <RoleIcon size={16} color={roleMeta.accent} />
            <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{roleDefinitions[currentRole]?.label || 'Viewer'} dashboard mode</span>
          </div>

          <div>
            <h1 className="text-gradient">{roleMeta.title}</h1>
            <p className="text-muted" style={{ marginTop: '0.5rem', maxWidth: '62ch' }}>{roleMeta.subtitle}</p>
            <p style={{ marginTop: '0.55rem', fontSize: '0.85rem', color: roleMeta.accent }}>
              {roleMeta.focusLabel}: {roleMeta.focusText}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
            <Link to={roleMeta.primaryAction.route} className="btn-primary">{roleMeta.primaryAction.label}</Link>
            <Link to={roleMeta.secondaryAction.route} className="btn-secondary">{roleMeta.secondaryAction.label}</Link>
          </div>
        </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Demo Role Switcher</p>
            <p style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
              Switch roles here to show how the same live system adapts for admins, coordinators, field volunteers, and viewers.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.75rem', marginTop: '0.9rem' }}>
              <select
                value={currentRole}
                onChange={(event) => handleRoleSwitch(event.target.value)}
                className="input-field"
                disabled={switchingRole}
                style={{ appearance: 'none' }}
              >
                {Object.entries(roleDefinitions).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
              <div className="glass-panel" style={{ padding: '0.85rem 1rem', minWidth: '125px', textAlign: 'center', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{switchingRole ? 'Switching...' : roleDefinitions[currentRole]?.label}</p>
              </div>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>{roleDefinitions[currentRole]?.description}</p>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Organization Scope</p>
              <p style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
                Phase 1 multi-organization coordination is now live. Switch between a single partner organization and a shared network-wide view.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.75rem', marginTop: '0.9rem' }}>
                <select
                  value={selectedOrganizationId}
                  onChange={(event) => handleOrganizationSwitch(event.target.value)}
                  className="input-field"
                  style={{ appearance: 'none' }}
                >
                  <option value="all">All organizations</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name} ({organization.shortName}) • {organization.needCount || 0} needs
                    </option>
                  ))}
                </select>
                <div className="glass-panel" style={{ padding: '0.85rem 1rem', minWidth: '140px', textAlign: 'center', background: 'rgba(255,255,255,0.025)' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{selectedOrganizationId === 'all' ? 'Mode' : 'Workspace'}</p>
                  <p style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '0.2rem' }}>{selectedOrganization?.shortName || 'NET'}</p>
                </div>
              </div>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                {selectedOrganizationId === 'all'
                  ? canUseNetworkView
                    ? 'You are seeing the shared network view across all partner organizations.'
                    : 'You are seeing the combined demo network. Admins and coordinators use this view to coordinate across organizations.'
                  : `${selectedOrganization?.name || 'Selected organization'} is the active scope for Mission Control.`}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input-field"
              style={{ width: '180px', appearance: 'none' }}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
            <button onClick={() => fetchData(language)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={18} className={loading ? 'spinning' : ''} />
              <span>{copy.refresh}</span>
            </button>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {(roleStats[currentRole] || roleStats.viewer).map((stat) => (
          <div key={stat.label} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', height: 'fit-content' }}>
              {stat.icon}
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{stat.label}</p>
              <h2 style={{ fontSize: '2.1rem', marginBottom: '4px' }}>{stat.value}</h2>
              <p style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--accent-green)' }}>
                <TrendingUp size={14} />
                {stat.trend}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(135deg, rgba(0,198,255,0.08), rgba(6,10,18,0.96) 55%, rgba(0,255,136,0.05))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Flagship Feature</p>
              <h3 style={{ marginTop: '0.35rem' }}>Verified Response Passport</h3>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.3rem', maxWidth: '60ch' }}>
                This is the platform’s strongest proof layer: qualified volunteers, evidence-backed delivery, coordinator verification, and trust scores that update from real operations.
              </p>
            </div>
            <Link to="/volunteer" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Open Passport View
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem' }}>
            {[
              { label: 'Avg Reliability', value: averageReliability, suffix: '/100' },
              { label: 'Verified Completions', value: verifiedCompletionCount, suffix: '' },
              { label: 'Evidence-Backed', value: evidenceBackedCount, suffix: '' }
            ].map((item) => (
              <div key={item.label} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem' }}>{item.value}{item.suffix}</p>
              </div>
            ))}
          </div>

          {passportChampion ? (
            <div className="glass-panel" style={{ padding: '1rem 1.05rem', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '0.7rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top Trusted Responder</p>
                  <p style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.22rem' }}>{passportChampion.name}</p>
                  <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.18rem' }}>
                    {passportChampion.skill} • {passportChampion.recognitionLevel || 'Reliable Volunteer'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Passport score</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800 }}>{passportChampion.reliabilityScore || 0}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <span className="text-muted" style={{ fontSize: '0.84rem' }}>{passportChampion.verifiedCompletions || 0} verified completions</span>
                <span className="text-muted" style={{ fontSize: '0.84rem' }}>{passportChampion.evidenceBackedVerifications || 0} evidence-backed</span>
                <span className="text-muted" style={{ fontSize: '0.84rem' }}>{passportChampion.rewardTier || 'Bronze Responder'}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '0.9rem', background: 'rgba(255,255,255,0.025)' }}>
          <div>
            <h3>Passport Logic</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
              Judges can understand the whole response loop from one compact story.
            </p>
          </div>
          {[
            'A need is reviewed and assigned to a qualified volunteer.',
            'The volunteer uploads field evidence after the mission is done.',
            'A coordinator verifies the completion to release trust credit.',
            'Reliability, recognition, and impact surfaces update automatically.'
          ].map((item) => (
            <div key={item} className="glass-panel" style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
              <p>{item}</p>
            </div>
          ))}
          <div className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontWeight: 700 }}>Why this matters</p>
            <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.24rem' }}>
              The passport makes response credibility visible. Instead of saying help was delivered, the system shows who delivered it, whether they were qualified, and whether completion was verified with proof.
            </p>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(300px, 0.85fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Role-Specific Briefing</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              This panel changes with the selected role so demo viewers can immediately understand how the workflow shifts.
            </p>
          </div>

          {currentRole === 'admin' ? (
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {[
                `There are ${criticalNeeds} critical needs and ${coverageGap} unfilled volunteer spots across live requests.`,
                `Unread approval-related alerts: ${notifications.filter((n) => n.type === 'review_queue' && !n.read).length}.`,
                `Admin controls include assignment management, intake oversight, and need deletion when records are not necessary.`
              ].map((item) => (
                <div key={item} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          ) : null}

          {currentRole === 'coordinator' ? (
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {[
                `Coordinator view emphasizes ${pendingAssignments} active assignments that still need monitoring.`,
                `${criticalNeeds} critical cases are visible for prioritization, and ${canReviewIntake ? 'you can open the approval queue directly.' : 'approval access is not enabled.'}`,
                `This role is optimized for throughput: convert incoming needs into staffed, progressing assignments.`
              ].map((item) => (
                <div key={item} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          ) : null}

          {currentRole === 'field_volunteer' ? (
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {myRecommendedTasks.length ? myRecommendedTasks.map((task) => (
                <div key={task.id} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p style={{ fontWeight: 700 }}>{task.translatedTitle || task.title}</p>
                  <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>
                    {task.category} • {task.location} • {task.openSpots} open spots
                  </p>
                </div>
              )) : (
                <div className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p>No role-specific volunteer matches are visible yet. As more tasks and skills are added, this panel will highlight strong field opportunities.</p>
                </div>
              )}
            </div>
          ) : null}

          {currentRole === 'viewer' ? (
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {viewerHighlights.length ? viewerHighlights.map((task) => (
                <div key={task.id} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p style={{ fontWeight: 700 }}>{task.translatedTitle || task.title}</p>
                  <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>
                    {task.location} • {task.translatedUrgency || task.urgency} • {task.currentAssignments?.length || 0}/{task.volunteersNeeded} staffed
                  </p>
                </div>
              )) : (
                <div className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p>The viewer dashboard is built for briefings, so this area highlights the clearest story from the live data feed.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(138,43,226,0.04))' }}>
          <div>
            <h3>Experience Difference</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              The same operational data is kept live, but the framing changes by role to match how each user thinks and acts.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            <div className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>Admin</p>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.16rem' }}>Oversight, approvals, deletion control, and executive-level system monitoring.</p>
            </div>
            <div className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>Coordinator</p>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.16rem' }}>Assignment throughput, urgent need triage, and intake-to-action flow.</p>
            </div>
            <div className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>Field Volunteer</p>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.16rem' }}>Mission awareness, impact context, and role-relevant action visibility.</p>
            </div>
            <div className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>Viewer</p>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.16rem' }}>A polished, read-only story that makes the platform easy to understand during demos.</p>
            </div>
          </div>
        </div>
      </section>

      {showNetworkBoard ? (
        <section style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(135deg, rgba(0,198,255,0.08), rgba(8,12,20,0.94) 55%, rgba(0,255,136,0.05))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phase 3</p>
                <h3 style={{ marginTop: '0.28rem' }}>Network Mutual Aid Board</h3>
                <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.28rem', maxWidth: '64ch' }}>
                  The platform now moves beyond visibility into action. Admins and coordinators can spot cross-organization staffing or supply opportunities and turn them into tracked mutual-aid requests.
                </p>
                <div style={{ marginTop: '0.85rem' }}>
                  <Link to="/network" className="btn-secondary">Open Network Command Center</Link>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '0.9rem 1rem', minWidth: '170px', background: 'rgba(255,255,255,0.03)' }}>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active requests</p>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.22rem' }}>{networkRequests.filter((request) => ['requested', 'approved_support', 'in_transit', 'delivered', 'verified'].includes(request.status)).length}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
              {networkOrganizations.map((organization) => (
                <div key={organization.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.7rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'start' }}>
                    <div>
                      <p style={{ fontWeight: 700 }}>{organization.name}</p>
                      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>{organization.shortName} • {organization.type || 'Partner organization'}</p>
                    </div>
                    <span style={{ padding: '0.3rem 0.65rem', borderRadius: '999px', background: 'rgba(0,240,255,0.12)', color: 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 }}>
                      {organization.activeNetworkRequests || 0} active
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem' }}>
                    {[
                      { label: 'Open spots', value: organization.openSpots || 0 },
                      { label: 'Critical needs', value: organization.criticalNeedCount || 0 },
                      { label: 'Low inventory', value: organization.lowInventoryCount || 0 },
                      { label: 'Reliability', value: `${organization.reliabilityAverage || 0}/100` }
                    ].map((item) => (
                      <div key={`${organization.id}-${item.label}`} className="glass-panel" style={{ padding: '0.75rem 0.8rem', background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-muted" style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                        <p style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.18rem' }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
              <div>
                <h3>Mutual Aid Opportunities</h3>
                <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.24rem' }}>
                  These recommendations are generated from open volunteer gaps, certification fit, and low-stock inventory pressure across partner organizations.
                </p>
              </div>
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                {networkOpportunities.length ? networkOpportunities.map((opportunity) => (
                  <div key={opportunity.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'start' }}>
                      <div>
                        <p style={{ fontWeight: 700 }}>{opportunity.summary}</p>
                        <p className="text-muted" style={{ fontSize: '0.83rem', marginTop: '0.22rem' }}>{opportunity.detail}</p>
                      </div>
                      <span style={getNetworkPriorityStyle(opportunity.priority)}>
                        {formatNetworkPriority(opportunity.priority)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ padding: '0.35rem 0.72rem', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', fontSize: '0.76rem' }}>
                        {opportunity.requestingOrganizationShortName} needs support
                      </span>
                      <span style={{ padding: '0.35rem 0.72rem', borderRadius: '999px', background: 'rgba(0,240,255,0.1)', color: 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 }}>
                        {opportunity.supportingOrganizationShortName} can help
                      </span>
                      <span style={{ padding: '0.35rem 0.72rem', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', fontSize: '0.76rem' }}>
                        {opportunity.suggestedUnits} suggested units
                      </span>
                    </div>
                    {opportunity.recommendedVolunteerNames?.length ? (
                      <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Suggested volunteers: {opportunity.recommendedVolunteerNames.join(', ')}.
                      </p>
                    ) : null}
                    {canManageAssignments ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleCreateNetworkRequest(opportunity)}
                          disabled={creatingNetworkRequestId === opportunity.id}
                          style={{ padding: '10px 16px', fontSize: '0.84rem' }}
                        >
                          {creatingNetworkRequestId === opportunity.id ? 'Creating...' : 'Open Mutual Aid Request'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )) : (
                  <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                    <p style={{ fontWeight: 700 }}>No fresh mutual-aid opportunities right now.</p>
                    <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.22rem' }}>
                      As staffing gaps or inventory shortages emerge across organizations, the board will recommend who can support whom.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,149,0,0.05))' }}>
              <div>
                <h3>Live Mutual Aid Requests</h3>
                <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.24rem' }}>
                  Every cross-organization support move is visible here so the network can demonstrate accountable coordination during demos.
                </p>
              </div>
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                {networkRequests.length ? networkRequests.slice(0, 6).map((request) => (
                  <div key={request.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'start', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ fontWeight: 700 }}>{request.summary}</p>
                        <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                          {request.requestingOrganizationShortName} to {request.supportingOrganizationShortName} • {request.resourceCategory}
                        </p>
                      </div>
                      <span style={getNetworkRequestStatusStyle(request.status)}>
                        {formatNetworkRequestStatus(request.status)}
                      </span>
                    </div>
                    {request.detail ? (
                      <p className="text-muted" style={{ fontSize: '0.82rem' }}>{request.detail}</p>
                    ) : null}
                    <p className="text-muted" style={{ fontSize: '0.78rem' }}>
                      Transfer: {request.transfer?.quantity || request.suggestedUnits || 0} {request.transfer?.unit || 'units'} • {request.transfer?.mode || 'Mode pending'} • Updated {formatDateTime(request.updatedAt || request.createdAt)}
                    </p>
                    {canManageAssignments ? (
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {request.status === 'requested' ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleNetworkRequestStatusChange(request, 'approve_support')}
                            disabled={updatingNetworkRequestId === request.id}
                            style={{ padding: '9px 14px', fontSize: '0.82rem' }}
                          >
                            {updatingNetworkRequestId === request.id ? 'Updating...' : 'Approve Support'}
                          </button>
                        ) : null}
                        {request.status === 'approved_support' ? (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleNetworkRequestStatusChange(request, 'mark_in_transit')}
                            disabled={updatingNetworkRequestId === request.id}
                            style={{ padding: '9px 14px', fontSize: '0.82rem' }}
                          >
                            {updatingNetworkRequestId === request.id ? 'Updating...' : 'Mark In Transit'}
                          </button>
                        ) : null}
                        {request.status === 'in_transit' ? (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleNetworkRequestStatusChange(request, 'confirm_delivery')}
                            disabled={updatingNetworkRequestId === request.id}
                            style={{ padding: '9px 14px', fontSize: '0.82rem' }}
                          >
                            {updatingNetworkRequestId === request.id ? 'Updating...' : 'Confirm Delivery'}
                          </button>
                        ) : null}
                        {request.status === 'delivered' ? (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleNetworkRequestStatusChange(request, 'verify_receipt')}
                            disabled={updatingNetworkRequestId === request.id}
                            style={{ padding: '9px 14px', fontSize: '0.82rem' }}
                          >
                            {updatingNetworkRequestId === request.id ? 'Updating...' : 'Verify Receipt'}
                          </button>
                        ) : null}
                        {request.status === 'verified' ? (
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleNetworkRequestStatusChange(request, 'close_request')}
                            disabled={updatingNetworkRequestId === request.id}
                            style={{ padding: '9px 14px', fontSize: '0.82rem' }}
                          >
                            {updatingNetworkRequestId === request.id ? 'Updating...' : 'Close Request'}
                          </button>
                        ) : null}
                        {['requested', 'approved_support', 'in_transit', 'delivered'].includes(request.status) ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleNetworkRequestStatusChange(request, 'cancel_request')}
                            disabled={updatingNetworkRequestId === request.id}
                            style={{ padding: '9px 14px', fontSize: '0.82rem', borderColor: 'rgba(255,99,132,0.35)', color: 'var(--accent-red)' }}
                          >
                            {updatingNetworkRequestId === request.id ? 'Updating...' : 'Cancel'}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )) : (
                  <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                    <p style={{ fontWeight: 700 }}>No mutual aid requests are open.</p>
                    <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.22rem' }}>
                      Open requests will appear here after coordinators activate a recommendation from the opportunity board.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <CrisisMap tasks={tasks} />

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.95fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Predictive Operations View</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              A lightweight forecast layer for likely demand pressure based on current needs, hotspots, and inventory signals.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
            <p style={{ fontWeight: 700 }}>{operationsInsights.predictiveInsights?.headline || 'Forecast data will appear as live needs and stock pressure increase.'}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem' }}>
            {(operationsInsights.predictiveInsights?.categories || []).slice(0, 3).map((row) => (
              <div key={row.category} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ fontWeight: 700 }}>{row.category}</p>
                <p className="text-muted" style={{ fontSize: '0.83rem', marginTop: '0.2rem' }}>{row.rationale}</p>
                <p style={{ marginTop: '0.45rem', color: row.forecastLevel === 'rising' ? 'var(--accent-orange)' : 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.82rem' }}>
                  Forecast: {row.forecastLevel}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,149,0,0.05))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h3>Inventory Readiness</h3>
              <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
                Resource availability is now visible alongside volunteer coordination.
              </p>
            </div>
            <div className="glass-panel" style={{ padding: '0.75rem 0.95rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Low stock items</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800 }}>{lowInventoryCount}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {inventory.slice(0, 4).map((item) => (
              <div key={item.id} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)', borderColor: item.status === 'low' ? 'rgba(255,149,0,0.28)' : 'var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{item.name}</p>
                    <p className="text-muted" style={{ fontSize: '0.82rem' }}>{item.location} • {item.category}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700 }}>{item.quantity} {item.unit}</p>
                    <p style={{ fontSize: '0.78rem', color: item.status === 'low' ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
                      {item.status === 'low' ? 'Restock soon' : 'Healthy'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <h3>Escalation Workflow</h3>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem', maxWidth: '62ch' }}>
                Needs are escalated automatically using a transparent priority score that weighs urgency, wait time, open coverage, beneficiary impact, supply pressure, and certification complexity.
              </p>
            </div>
            <div className="glass-panel" style={{ padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Open escalations</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{escalatedCount}</p>
            </div>
          </div>

          {escalations.length ? escalations.map((task, escalationIndex) => {
            const escalation = task.escalation || {};
            const isCritical = escalation.level === 'critical';
            const isAcknowledged = escalation.status === 'acknowledged';
            const escalationKey = task.id || `${task.title || 'escalation'}-${task.location || 'unknown'}-${escalationIndex}`;

            return (
              <div
                key={escalationKey}
                className="glass-panel"
                style={{
                  padding: '1rem 1.1rem',
                  background: isCritical ? 'rgba(255, 82, 82, 0.08)' : 'rgba(255,255,255,0.025)',
                  border: isCritical ? '1px solid rgba(255, 82, 82, 0.3)' : '1px solid var(--glass-border)',
                  display: 'grid',
                  gap: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '0.28rem 0.75rem',
                        borderRadius: '999px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: isAcknowledged ? 'rgba(0, 200, 160, 0.15)' : isCritical ? 'rgba(255,82,82,0.18)' : 'rgba(255,149,0,0.18)',
                        color: isAcknowledged ? 'var(--accent-green)' : isCritical ? '#ff8a8a' : '#ffc266'
                      }}>
                        {isAcknowledged ? 'Acknowledged' : escalation.level || 'Escalated'}
                      </span>
                      <span className="text-muted" style={{ fontSize: '0.82rem' }}>
                        {task.translatedUrgency || task.urgency} • {task.location}
                      </span>
                    </div>
                    <p style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.55rem' }}>{task.translatedTitle || task.title}</p>
                      <p className="text-muted" style={{ fontSize: '0.86rem', marginTop: '0.3rem' }}>{escalation.trigger}</p>
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.55rem' }}>
                      <span style={{ padding: '0.28rem 0.68rem', borderRadius: '999px', background: 'rgba(0,240,255,0.12)', color: 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 }}>
                        {task.organizationShortName || task.organizationName || 'Organization'}
                      </span>
                    </div>
                    {Array.isArray(escalation.reasons) && escalation.reasons.length ? (
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
                        {escalation.reasons.slice(0, 4).map((reason) => (
                          <span key={reason} style={{ padding: '0.28rem 0.68rem', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                            {reason}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ minWidth: '160px', textAlign: 'right' }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Coverage</p>
                    <p style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                      {task.currentAssignments?.length || 0}/{task.volunteersNeeded}
                    </p>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>{task.openSpots} open spots</p>
                    <p style={{ fontSize: '0.86rem', fontWeight: 700, marginTop: '0.45rem', color: isCritical ? '#ffb3b3' : 'var(--accent-orange)' }}>
                      Score {escalation.score || 0}/100
                    </p>
                    <p className="text-muted" style={{ fontSize: '0.76rem' }}>
                      Window {escalation.ageMinutes || 0}/{escalation.responseWindowMinutes || 0} min
                    </p>
                  </div>
                </div>

                {escalation.recommendedAction ? (
                  <div className="glass-panel" style={{ padding: '0.82rem 0.95rem', background: 'rgba(255,255,255,0.03)' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.82rem' }}>Recommended action</p>
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>{escalation.recommendedAction}</p>
                  </div>
                ) : null}

                {isAcknowledged && escalation.acknowledgedBy?.role ? (
                  <p className="text-muted" style={{ fontSize: '0.82rem' }}>
                    Acknowledged by {escalation.acknowledgedBy.role} on {new Date(escalation.acknowledgedAt).toLocaleString()}.
                  </p>
                ) : null}

                {canAcknowledgeEscalations ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isAcknowledged || acknowledgingEscalationId === task.id}
                      onClick={() => handleAcknowledgeEscalation(task)}
                      style={{
                        padding: '10px 16px',
                        fontSize: '0.85rem',
                        borderColor: isCritical ? 'rgba(255,82,82,0.35)' : 'var(--glass-border)',
                        color: isCritical ? '#ffb3b3' : 'var(--text-primary)'
                      }}
                    >
                      {acknowledgingEscalationId === task.id ? 'Acknowledging...' : isAcknowledged ? 'Acknowledged' : 'Acknowledge Escalation'}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }) : (
            <div className="glass-panel" style={{ padding: '1rem 1.1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>No escalations are open right now.</p>
              <p className="text-muted" style={{ fontSize: '0.86rem', marginTop: '0.35rem' }}>
                When urgent needs go too long without enough assigned volunteers, they will appear here for coordinator and admin action.
              </p>
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,149,0,0.05))' }}>
          <div>
            <h3>Workflow Logic</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              This gives the platform a realistic operational chain instead of treating every need as equal forever.
            </p>
          </div>
          {[
            'Urgency, wait time, beneficiary impact, open spots, low inventory, and required badges all feed into one visible priority score.',
            'Very high scores can escalate even before the full response window expires, which makes the system feel proactive instead of delayed.',
            'Coordinators and admins can acknowledge an escalation to show it has human attention and ownership.',
            'The queue stays visible until coverage improves, so judges can see a full, auditable intervention path.'
          ].map((item) => (
            <div key={item} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h3>{copy.needsHeading}</h3>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                Coordinators can filter volunteer recommendations by certification badge before assigning.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {canManageAssignments ? (
                <select
                  value={certificationFilter}
                  onChange={(event) => setCertificationFilter(event.target.value)}
                  className="input-field"
                  style={{ width: '220px', appearance: 'none' }}
                >
                  <option value="all">All certifications</option>
                  {certificationOptions.map((badge) => (
                    <option key={badge} value={badge}>{badge}</option>
                  ))}
                </select>
              ) : null}
              <Link to="/intake" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>{copy.addNeed}</Link>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sortedTasks.length === 0 ? <p className="text-muted">{copy.noNeeds}</p> : null}
            {sortedTasks.map((task, taskIndex) => {
              const recommendedVolunteers = getRecommendedVolunteers(task, volunteers, certificationFilter);
              const taskKey = task.id || `${task.title || 'task'}-${task.location || 'unknown'}-${taskIndex}`;

              return (
                <div
                  key={taskKey}
                  className="task-card-hover"
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'grid',
                    gap: '1.2rem',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {renderUrgencyBadge(task)}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{task.translatedCategory || task.category}</span>
                      </div>
                      <h4 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{task.translatedTitle || task.title}</h4>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        <MapPin size={16} color="var(--accent-cyan)" />
                        {task.location}
                      </p>
                      <p className="text-muted" style={{ fontSize: '0.88rem', maxWidth: '56ch' }}>{task.notes}</p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                        <span style={{ padding: '0.34rem 0.72rem', borderRadius: '999px', background: 'rgba(0,240,255,0.12)', color: 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 }}>
                          {task.organizationShortName || task.organizationName || 'Organization'}
                        </span>
                      </div>
                      {Number(task.escalation?.score || 0) >= 40 ? (
                        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.78rem', borderRadius: '999px', background: task.escalation?.status === 'escalated' ? 'rgba(255,59,48,0.14)' : 'rgba(255,149,0,0.14)', color: task.escalation?.status === 'escalated' ? 'var(--accent-red)' : 'var(--accent-orange)', fontSize: '0.78rem', fontWeight: 700 }}>
                            <Zap size={14} />
                            {task.escalation?.priorityBand || 'Priority'} • {task.escalation?.score || 0}/100
                          </span>
                          {task.escalation?.reasons?.slice(0, 2).map((reason) => (
                            <span key={reason} style={{ padding: '0.4rem 0.72rem', borderRadius: '999px', background: 'rgba(255,255,255,0.045)', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                              {reason}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {task.requiredBadge ? (
                        <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.4rem 0.75rem', borderRadius: '999px', background: 'rgba(255,209,102,0.12)', color: '#ffd166', fontSize: '0.78rem', fontWeight: 700 }}>
                          <ShieldCheck size={14} />
                          Required badge: {task.requiredBadge}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '180px' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{copy.volunteersNeeded}</p>
                      <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                        {task.currentAssignments?.length || 0} <span style={{ color: 'var(--text-muted)' }}>/ {task.volunteersNeeded}</span>
                      </p>
                      <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                        {task.openSpots} open spots
                      </p>
                    </div>
                  </div>

                  {canManageAssignments ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', gap: '0.75rem', alignItems: 'end' }}>
                      <div>
                        <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>Recommended Volunteer</p>
                        <select
                          value={selectedVolunteerByTask[task.id] || ''}
                          onChange={(event) => setSelectedVolunteerByTask((current) => ({ ...current, [task.id]: event.target.value }))}
                          className="input-field"
                          style={{ appearance: 'none' }}
                        >
                          {recommendedVolunteers.map((volunteer, volunteerIndex) => {
                            const volunteerKey = volunteer.id || `${volunteer.name || 'volunteer'}-${volunteer.location || 'unknown'}-${volunteerIndex}`;
                            const volunteerValue = volunteer.id || volunteerKey;

                            return (
                            <option key={volunteerKey} value={volunteerValue}>
                              {volunteer.name} • {volunteer.skill} • {volunteer.location} • {(volunteer.certifications || []).join(', ') || 'No certification'}
                            </option>
                            );
                          })}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleFindMatch(task)}
                        disabled={matchingTaskId === task.id}
                        style={{
                          padding: '10px 16px',
                          fontSize: '0.85rem',
                          opacity: matchingTaskId === task.id ? 0.7 : 1,
                          cursor: matchingTaskId === task.id ? 'wait' : 'pointer'
                        }}
                      >
                        {matchingTaskId === task.id ? copy.finding : copy.findMatch}
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleAssignVolunteer(task)}
                        disabled={assigningTaskId === task.id}
                        style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                      >
                        {assigningTaskId === task.id ? 'Assigning...' : 'Assign Volunteer'}
                      </button>
                      {canDeleteNeeds ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleDeleteNeed(task)}
                          disabled={deletingTaskId === task.id}
                          style={{
                            padding: '10px 16px',
                            fontSize: '0.85rem',
                            borderColor: 'rgba(255, 99, 132, 0.35)',
                            color: 'var(--accent-red)'
                          }}
                        >
                          {deletingTaskId === task.id ? 'Deleting...' : 'Delete Need'}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="glass-panel" style={{ padding: '1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.025)' }}>
                      <p style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Read-Only Role</p>
                      <p className="text-muted" style={{ fontSize: '0.86rem' }}>
                        {currentUser?.role === 'field_volunteer'
                          ? 'Field volunteers can monitor assignments and system intelligence here, but only coordinators and admins can create or change assignments.'
                          : 'Viewers can inspect mission activity, assignment status, and response momentum without changing operational data.'}
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    <p className="text-muted" style={{ fontSize: '0.82rem' }}>Active Assignments</p>
                    {task.currentAssignments?.length ? task.currentAssignments.map((assignment, assignmentIndex) => {
                      const assignmentKey = assignment.id || `${assignment.volunteerName || 'assignment'}-${assignment.status || 'unknown'}-${assignmentIndex}`;

                      return (
                      <div
                        key={assignmentKey}
                        style={{
                          display: 'grid',
                          gap: '0.9rem',
                          padding: '0.9rem 1rem',
                          borderRadius: '14px',
                          background: 'rgba(255,255,255,0.035)',
                          border: '1px solid var(--glass-border)'
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.9rem', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontWeight: 700 }}>{assignment.volunteerName}</p>
                            <p className="text-muted" style={{ fontSize: '0.83rem' }}>{assignment.volunteerSkill} • {assignment.volunteerLocation} • {assignment.organizationShortName || assignment.organizationName || 'Organization'}</p>
                          </div>
                          {canManageAssignments ? (
                            <select
                              value={assignment.status}
                              onChange={(event) => handleAssignmentStatusChange(assignment.id, event.target.value)}
                              className="input-field"
                              disabled={statusUpdatingId === assignment.id}
                              style={{ width: '150px', appearance: 'none', fontSize: '0.9rem' }}
                            >
                              {assignmentStatuses.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="glass-panel" style={{ padding: '0.7rem 0.9rem', borderRadius: '12px', minWidth: '140px', textAlign: 'center', background: 'rgba(255,255,255,0.025)' }}>
                              <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{assignment.statusLabel}</p>
                            </div>
                          )}
                        </div>

                        <div className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div>
                              <p style={{ fontWeight: 700 }}>Completion Trust</p>
                              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.18rem' }}>
                                Coordinators can verify the completion after reviewing field evidence and final status.
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                              <span style={{
                                padding: '0.32rem 0.72rem',
                                borderRadius: '999px',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                background: assignment.verifiedCompletion?.status === 'verified' ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.05)',
                                color: assignment.verifiedCompletion?.status === 'verified' ? 'var(--accent-green)' : 'var(--text-muted)'
                              }}>
                                {assignment.verifiedCompletion?.status === 'verified' ? 'Verified completion' : 'Awaiting verification'}
                              </span>
                              {canVerifyCompletion && assignment.status === 'completed' && assignment.verifiedCompletion?.status !== 'verified' ? (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => handleVerifyCompletion(task, assignment)}
                                  disabled={verifyingAssignmentId === assignment.id}
                                  style={{ padding: '9px 14px', fontSize: '0.82rem' }}
                                >
                                  {verifyingAssignmentId === assignment.id ? 'Verifying...' : 'Verify Completion'}
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {assignment.verifiedCompletion?.status === 'verified' ? (
                            <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                              Verified on {formatDateTime(assignment.verifiedCompletion.verifiedAt)} by {assignment.verifiedCompletion.verifiedBy?.role || 'coordinator'}.
                            </p>
                          ) : null}

                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div>
                              <p style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <Camera size={15} color="var(--accent-cyan)" />
                                Field Evidence
                              </p>
                              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.18rem' }}>
                                Upload photos or on-site proof so coordinators can verify real field work.
                              </p>
                            </div>
                            <div className="glass-panel" style={{ padding: '0.55rem 0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Evidence files</p>
                              <p style={{ fontSize: '1rem', fontWeight: 700 }}>{assignment.evidence?.length || 0}</p>
                            </div>
                          </div>

                          {assignment.evidence?.length ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem' }}>
                              {assignment.evidence.map((item, evidenceIndex) => {
                                const evidenceKey = item.id || `${assignment.id}-evidence-${evidenceIndex}`;

                                return (
                                  <div key={evidenceKey} className="glass-panel" style={{ padding: '0.7rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '0.55rem' }}>
                                    <img
                                      src={item.imageData}
                                      alt={item.fileName || 'Field evidence'}
                                      style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}
                                    />
                                    <div>
                                      <p style={{ fontSize: '0.82rem', fontWeight: 700 }}>{item.fileName || 'Evidence image'}</p>
                                      <p className="text-muted" style={{ fontSize: '0.76rem', marginTop: '0.18rem' }}>{formatDateTime(item.uploadedAt)}</p>
                                      {item.notes ? (
                                        <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>{item.notes}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-muted" style={{ fontSize: '0.83rem' }}>No field evidence has been uploaded for this assignment yet.</p>
                          )}

                          {canUploadEvidence ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'end' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Evidence image</label>
                                <label className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer' }}>
                                  <Upload size={15} color="var(--accent-cyan)" />
                                  <span style={{ color: evidenceDrafts[assignment.id]?.fileName ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {evidenceDrafts[assignment.id]?.fileName || 'Choose photo'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(event) => handleEvidenceFileChange(assignment.id, event.target.files?.[0] || null)}
                                  />
                                </label>
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Evidence notes</label>
                                <input
                                  type="text"
                                  className="input-field"
                                  value={evidenceDrafts[assignment.id]?.notes || ''}
                                  onChange={(event) => handleEvidenceNotesChange(assignment.id, event.target.value)}
                                  placeholder="What does this prove?"
                                />
                              </div>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleUploadEvidence(task, assignment)}
                                disabled={uploadingEvidenceId === assignment.id}
                                style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                              >
                                {uploadingEvidenceId === assignment.id ? 'Uploading...' : 'Upload Evidence'}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      );
                    }) : (
                      <p className="text-muted" style={{ fontSize: '0.88rem' }}>No volunteers assigned yet. Pick a recommended volunteer to start the workflow.</p>
                    )}
                    {canManageAssignments && !recommendedVolunteers.length ? (
                      <p className="text-muted" style={{ fontSize: '0.82rem' }}>
                        No volunteers match the current certification filter{task.requiredBadge ? ` and required badge ${task.requiredBadge}` : ''}.
                      </p>
                    ) : null}
                  </div>

                  {canManageAssignments ? (
                    <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.75rem' }}>
                      <div>
                        <p style={{ fontWeight: 700 }}>Outcome Tracking</p>
                        <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                          Track whether the need was resolved and how many beneficiaries were supported.
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 130px minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'end' }}>
                        <select
                          className="input-field"
                          value={outcomeDrafts[task.id]?.status || task.outcome?.status || 'open'}
                          onChange={(event) => setOutcomeDrafts((current) => ({
                            ...current,
                            [task.id]: {
                              ...(current[task.id] || {}),
                              status: event.target.value,
                              beneficiaryCount: current[task.id]?.beneficiaryCount ?? task.outcome?.beneficiaryCount ?? 0,
                              summary: current[task.id]?.summary ?? task.outcome?.summary ?? ''
                            }
                          }))}
                          style={{ appearance: 'none' }}
                        >
                          {['open', 'partially_resolved', 'resolved', 'closed'].map((status) => (
                            <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          className="input-field"
                          value={outcomeDrafts[task.id]?.beneficiaryCount ?? task.outcome?.beneficiaryCount ?? 0}
                          onChange={(event) => setOutcomeDrafts((current) => ({
                            ...current,
                            [task.id]: {
                              ...(current[task.id] || {}),
                              status: current[task.id]?.status ?? task.outcome?.status ?? 'open',
                              beneficiaryCount: Number(event.target.value) || 0,
                              summary: current[task.id]?.summary ?? task.outcome?.summary ?? ''
                            }
                          }))}
                          placeholder="Beneficiaries"
                        />
                        <input
                          type="text"
                          className="input-field"
                          value={outcomeDrafts[task.id]?.summary ?? task.outcome?.summary ?? ''}
                          onChange={(event) => setOutcomeDrafts((current) => ({
                            ...current,
                            [task.id]: {
                              ...(current[task.id] || {}),
                              status: current[task.id]?.status ?? task.outcome?.status ?? 'open',
                              beneficiaryCount: current[task.id]?.beneficiaryCount ?? task.outcome?.beneficiaryCount ?? 0,
                              summary: event.target.value
                            }
                          }))}
                          placeholder="Outcome summary"
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleOutcomeUpdate(task)}
                          disabled={updatingOutcomeId === task.id}
                          style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                        >
                          {updatingOutcomeId === task.id ? 'Saving...' : 'Save Outcome'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <NotificationsPanel
            notifications={notifications}
            unreadCount={unreadNotificationCount}
            onMarkRead={(id) => markNotificationsRead(id)}
            onMarkAllRead={() => markNotificationsRead()}
            markingNotificationId={markingNotificationId}
          />

          <div className="glass-panel" style={{ padding: '2rem', background: 'linear-gradient(180deg, rgba(30,30,38,0.8) 0%, rgba(138,43,226,0.05) 100%)' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={20} color="var(--accent-purple)" />
              {copy.intelligenceTitle}
            </h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>{copy.intelligenceBody}</p>

            <div style={{ background: 'var(--glass-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--accent-purple)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-purple)', marginBottom: '8px' }}>
                <Activity size={18} /> {copy.analysis}
              </h4>
              <div style={{ fontSize: '0.95rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                {loading ? 'Analyzing variables...' : insight}
              </div>
            </div>
          </div>

          <DispatchFeed logs={dispatchLogs} />
        </div>
      </section>

      <Leaderboard volunteers={volunteers} />

      <style>{`
        .task-card-hover:hover {
          background: rgba(255,255,255,0.03) !important;
          border-color: rgba(0,240,255,0.3) !important;
          transform: translateX(4px);
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function getRecommendedVolunteers(task, volunteers, certificationFilter = 'all') {
  const certificationFiltered = certificationFilter === 'all'
    ? volunteers
    : volunteers.filter((volunteer) => (volunteer.certifications || []).includes(certificationFilter));
  const badgeEligible = task.requiredBadge
    ? certificationFiltered.filter((volunteer) => (volunteer.certifications || []).includes(task.requiredBadge))
    : certificationFiltered;
  const categoryMatches = badgeEligible.filter((volunteer) => volunteer.skill === task.category);
  return (categoryMatches.length ? categoryMatches : badgeEligible).slice(0, 4);
}

function buildSelectionState(tasks, volunteers, currentState, certificationFilter = 'all') {
  const nextState = { ...currentState };

  tasks.forEach((task) => {
    const recommended = getRecommendedVolunteers(task, volunteers, certificationFilter);
    const hasValidCurrentSelection = recommended.some((volunteer) => String(volunteer.id) === String(nextState[task.id]));

    if (nextState[task.id] && hasValidCurrentSelection) {
      return;
    }

    nextState[task.id] = recommended[0]?.id || '';
  });

  return nextState;
}

function buildOrganizationQuery(organizationId) {
  if (!organizationId || organizationId === 'all') {
    return '';
  }

  return `?orgId=${encodeURIComponent(organizationId)}`;
}

function formatNetworkPriority(priority = 'normal') {
  if (priority === 'critical') return 'Critical';
  if (priority === 'high') return 'High';
  if (priority === 'watch') return 'Watch';
  return 'Normal';
}

function getNetworkPriorityStyle(priority = 'normal') {
  if (priority === 'critical') {
    return {
      padding: '0.35rem 0.72rem',
      borderRadius: '999px',
      background: 'rgba(255,59,48,0.14)',
      color: 'var(--accent-red)',
      fontSize: '0.76rem',
      fontWeight: 700
    };
  }

  if (priority === 'high') {
    return {
      padding: '0.35rem 0.72rem',
      borderRadius: '999px',
      background: 'rgba(255,149,0,0.14)',
      color: 'var(--accent-orange)',
      fontSize: '0.76rem',
      fontWeight: 700
    };
  }

  return {
    padding: '0.35rem 0.72rem',
    borderRadius: '999px',
    background: 'rgba(0,240,255,0.1)',
    color: 'var(--accent-cyan)',
    fontSize: '0.76rem',
    fontWeight: 700
  };
}

function formatNetworkRequestStatus(status = 'open') {
  if (status === 'approved_support') return 'Support Approved';
  if (status === 'in_transit') return 'In Transit';
  if (status === 'delivered') return 'Delivered';
  if (status === 'verified') return 'Verified';
  if (status === 'closed') return 'Closed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Requested';
}

function getNetworkRequestStatusStyle(status = 'open') {
  if (status === 'closed') {
    return {
      padding: '0.35rem 0.72rem',
      borderRadius: '999px',
      background: 'rgba(0,255,136,0.12)',
      color: 'var(--accent-green)',
      fontSize: '0.76rem',
      fontWeight: 700
    };
  }

  if (status === 'approved_support' || status === 'in_transit') {
    return {
      padding: '0.35rem 0.72rem',
      borderRadius: '999px',
      background: 'rgba(0,240,255,0.1)',
      color: 'var(--accent-cyan)',
      fontSize: '0.76rem',
      fontWeight: 700
    };
  }

  if (status === 'cancelled') {
    return {
      padding: '0.35rem 0.72rem',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.05)',
      color: 'var(--text-muted)',
      fontSize: '0.76rem',
      fontWeight: 700
    };
  }

  return {
    padding: '0.35rem 0.72rem',
    borderRadius: '999px',
    background: status === 'delivered' ? 'rgba(255,209,102,0.14)' : 'rgba(255,149,0,0.14)',
    color: status === 'delivered' ? '#ffd166' : 'var(--accent-orange)',
    fontSize: '0.76rem',
    fontWeight: 700
  };
}

function buildOutcomeDrafts(tasks, currentState) {
  const nextState = { ...currentState };

  tasks.forEach((task) => {
    if (nextState[task.id]) {
      return;
    }

    nextState[task.id] = {
      status: task.outcome?.status || 'open',
      beneficiaryCount: task.outcome?.beneficiaryCount || 0,
      summary: task.outcome?.summary || ''
    };
  });

  return nextState;
}

function buildEvidenceDrafts(tasks, currentState) {
  const nextState = { ...currentState };

  tasks.forEach((task) => {
    (task.currentAssignments || []).forEach((assignment) => {
      if (nextState[assignment.id]) {
        return;
      }

      nextState[assignment.id] = {
        file: null,
        fileName: '',
        mimeType: '',
        imageData: '',
        notes: ''
      };
    });
  });

  return nextState;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ imageData: reader.result, mimeType: file.type || 'image/png' });
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value) {
  if (!value) {
    return 'Unknown time';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }

  return parsed.toLocaleString();
}
