const REWARD_POINTS = {
  assignmentAccepted: 10,
  assignmentCompleted: 40,
  criticalAssignmentBonus: 20,
  highUrgencyBonus: 10,
  weeklyStreakBonus: 30,
  certificationCompleted: 25,
  verifiedCompletionBonus: 35
};

function toDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getWeekKey(value = new Date()) {
  const parsed = toDate(value) || new Date();
  const utcDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

function getMonthKey(value = new Date()) {
  const parsed = toDate(value) || new Date();
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
}

function rewardTierForPoints(points = 0) {
  if (points >= 500) return 'Platinum Responder';
  if (points >= 250) return 'Gold Responder';
  if (points >= 100) return 'Silver Responder';
  return 'Bronze Responder';
}

function normalizeEvent(event = {}) {
  const awardedAt = event.awardedAt || new Date().toISOString();
  return {
    id: event.id || `reward-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type: event.type || 'reward',
    points: Number(event.points) || 0,
    summary: event.summary || 'Volunteer reward recorded.',
    awardedAt,
    dedupeKey: event.dedupeKey || null,
    metadata: event.metadata || {},
    weekKey: event.weekKey || getWeekKey(awardedAt),
    monthKey: event.monthKey || getMonthKey(awardedAt)
  };
}

function buildAssignmentActivityEntry(activity = {}) {
  const recordedAt = activity.recordedAt || new Date().toISOString();
  return {
    assignmentId: String(activity.assignmentId || ''),
    needId: String(activity.needId || ''),
    status: activity.status || 'completed',
    urgency: activity.urgency || 'Medium',
    title: activity.title || '',
    recordedAt,
    weekKey: activity.weekKey || getWeekKey(recordedAt),
    monthKey: activity.monthKey || getMonthKey(recordedAt)
  };
}

function hasRewardEvent(history = [], dedupeKey) {
  return Boolean(dedupeKey) && history.some((event) => event.dedupeKey === dedupeKey);
}

function deriveAchievements(volunteer, summary) {
  const achievements = Array.isArray(volunteer.achievements) ? [...volunteer.achievements] : [];
  const dynamicAchievements = [
    summary.completedThisWeek >= 3 ? 'Weekly Hero' : null,
    summary.completedThisMonth >= 6 ? 'Monthly Force' : null,
    Number(volunteer.missionsCompleted || 0) >= 5 ? 'Mission Finisher' : null,
    summary.criticalMissionsCompleted >= 1 ? 'Critical Responder' : null,
    (volunteer.certifications || []).length >= 2 ? 'Skilled Responder' : null,
    summary.rewardPoints >= 250 ? 'Gold Contributor' : null,
    summary.rewardPoints >= 500 ? 'Elite Field Leader' : null
  ].filter(Boolean);

  return Array.from(new Set([...achievements, ...dynamicAchievements]));
}

function buildRewardProfile(volunteer = {}) {
  const rewardHistory = Array.isArray(volunteer.rewardHistory)
    ? volunteer.rewardHistory.map(normalizeEvent)
    : [];
  const assignmentActivity = Array.isArray(volunteer.assignmentActivity)
    ? volunteer.assignmentActivity.map(buildAssignmentActivityEntry)
    : [];
  const fallbackPoints = Number(volunteer.impactScore || 0) + ((volunteer.certifications || []).length * REWARD_POINTS.certificationCompleted);
  const rewardPoints = Number(volunteer.rewardPoints ?? fallbackPoints) || 0;
  const currentWeekKey = getWeekKey();
  const currentMonthKey = getMonthKey();
  const completedActivity = assignmentActivity.filter((entry) => entry.status === 'completed');
  const acceptedAssignments = new Set(
    assignmentActivity
      .filter((entry) => ['accepted', 'en_route', 'completed'].includes(entry.status))
      .map((entry) => entry.assignmentId)
  );
  const completedAssignments = new Set(completedActivity.map((entry) => entry.assignmentId));
  const verifiedCompletionEvents = rewardHistory.filter((entry) => entry.type === 'verified_completion');
  const verifiedCompletions = verifiedCompletionEvents.length;
  const evidenceBackedVerifications = verifiedCompletionEvents.filter((entry) => entry.metadata?.hasEvidence).length;
  const completedThisWeek = completedActivity.filter((entry) => entry.weekKey === currentWeekKey).length;
  const completedThisMonth = completedActivity.filter((entry) => entry.monthKey === currentMonthKey).length;
  const weeklyPoints = rewardHistory
    .filter((entry) => entry.weekKey === currentWeekKey)
    .reduce((sum, entry) => sum + Number(entry.points || 0), 0);
  const monthlyPoints = rewardHistory
    .filter((entry) => entry.monthKey === currentMonthKey)
    .reduce((sum, entry) => sum + Number(entry.points || 0), 0);
  const criticalMissionsCompleted = completedActivity.filter((entry) => entry.urgency === 'Critical').length;
  const currentStreak = calculateWeeklyStreak(completedActivity);
  const reliabilityScore = calculateReliabilityScore({
    acceptedCount: acceptedAssignments.size,
    completedCount: completedAssignments.size,
    verifiedCount: verifiedCompletions,
    evidenceBackedVerifiedCount: evidenceBackedVerifications,
    certificationCount: (volunteer.certifications || []).length
  });
  const summary = {
    rewardPoints,
    rewardTier: rewardTierForPoints(rewardPoints),
    weeklyPoints,
    monthlyPoints,
    completedThisWeek,
    completedThisMonth,
    currentStreak,
    criticalMissionsCompleted,
    reliabilityScore,
    verifiedCompletions,
    evidenceBackedVerifications
  };

  return {
    rewardPoints,
    rewardTier: summary.rewardTier,
    rewardHistory,
    assignmentActivity,
    weeklyPoints,
    monthlyPoints,
    completedThisWeek,
    completedThisMonth,
    currentStreak,
    criticalMissionsCompleted,
    reliabilityScore,
    recognitionLevel: recognitionLevelForScore(reliabilityScore),
    verifiedCompletions,
    evidenceBackedVerifications,
    achievements: deriveAchievements(volunteer, summary)
  };
}

function calculateReliabilityScore({
  acceptedCount = 0,
  completedCount = 0,
  verifiedCount = 0,
  evidenceBackedVerifiedCount = 0,
  certificationCount = 0
}) {
  if (!acceptedCount && !completedCount && !verifiedCount) {
    return Math.min(60 + (certificationCount * 8), 80);
  }

  const completionRate = acceptedCount ? completedCount / acceptedCount : 0;
  const verificationRate = completedCount ? verifiedCount / completedCount : 0;
  const evidenceRate = verifiedCount ? evidenceBackedVerifiedCount / verifiedCount : 0;
  const certificationBonus = Math.min(certificationCount * 4, 10);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round((completionRate * 50) + (verificationRate * 30) + (evidenceRate * 10) + 10 + certificationBonus)
    )
  );
}

function recognitionLevelForScore(score = 0) {
  if (score >= 90) {
    return 'Trusted Field Leader';
  }
  if (score >= 75) {
    return 'Verified Responder';
  }
  if (score >= 60) {
    return 'Reliable Volunteer';
  }
  return 'Building Trust';
}

function calculateWeeklyStreak(completedActivity = []) {
  if (!completedActivity.length) {
    return 0;
  }

  const weeks = new Set(completedActivity.map((entry) => entry.weekKey));
  let streak = 0;
  let cursor = new Date();

  while (weeks.has(getWeekKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  return streak;
}

function applyRewardEvent(volunteer = {}, rewardEvent, activityEntry = null) {
  const rewardProfile = buildRewardProfile(volunteer);
  if (hasRewardEvent(rewardProfile.rewardHistory, rewardEvent.dedupeKey)) {
    return {
      ...volunteer,
      ...rewardProfile
    };
  }

  const nextHistory = [...rewardProfile.rewardHistory, normalizeEvent(rewardEvent)];
  const nextActivity = activityEntry
    ? [...rewardProfile.assignmentActivity, buildAssignmentActivityEntry(activityEntry)]
    : rewardProfile.assignmentActivity;
  let nextVolunteer = {
    ...volunteer,
    rewardPoints: rewardProfile.rewardPoints + Number(rewardEvent.points || 0),
    rewardHistory: nextHistory,
    assignmentActivity: nextActivity
  };

  const streakWeekKey = activityEntry?.status === 'completed' ? getWeekKey(activityEntry.recordedAt) : null;
  if (streakWeekKey) {
    const completedThisWeek = nextActivity.filter((entry) => entry.status === 'completed' && entry.weekKey === streakWeekKey).length;
    const streakDedupeKey = `weekly-streak:${streakWeekKey}`;

    if (completedThisWeek >= 3 && !hasRewardEvent(nextHistory, streakDedupeKey)) {
      const streakEvent = normalizeEvent({
        type: 'weekly_streak_bonus',
        points: REWARD_POINTS.weeklyStreakBonus,
        summary: 'Weekly consistency bonus earned after completing three missions in one week.',
        awardedAt: activityEntry.recordedAt,
        dedupeKey: streakDedupeKey,
        metadata: {
          weekKey: streakWeekKey
        }
      });
      nextHistory.push(streakEvent);
      nextVolunteer.rewardPoints += streakEvent.points;
      nextVolunteer.rewardHistory = nextHistory;
    }
  }

  const normalizedRewardProfile = buildRewardProfile(nextVolunteer);
  return {
    ...nextVolunteer,
    ...normalizedRewardProfile
  };
}

module.exports = {
  REWARD_POINTS,
  applyRewardEvent,
  buildRewardProfile,
  getMonthKey,
  getWeekKey,
  rewardTierForPoints
};
