const { deleteDocument, enrichVolunteer, getUserProfile, setDocument } = require('../models/dataStore');
const { getVolunteers, logAuditEvent } = require('../services/operationsService');

async function listVolunteers(req, res) {
  const certification = req.query.certification ? String(req.query.certification) : null;
  const period = String(req.query.period || 'all').toLowerCase();
  const orgId = req.query.orgId && req.query.orgId !== 'all' ? String(req.query.orgId) : null;
  const leaderboard = (await getVolunteers())
    .filter((volunteer) => !orgId || String(volunteer.organizationId) === orgId)
    .filter((volunteer) => !certification || (volunteer.certifications || []).includes(certification))
    .sort((left, right) => {
      const leftScore = period === 'weekly'
        ? Number(left.weeklyPoints || 0)
        : period === 'monthly'
          ? Number(left.monthlyPoints || 0)
          : Number(left.rewardPoints || left.impactScore || 0);
      const rightScore = period === 'weekly'
        ? Number(right.weeklyPoints || 0)
        : period === 'monthly'
          ? Number(right.monthlyPoints || 0)
          : Number(right.rewardPoints || right.impactScore || 0);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return Number(right.missionsCompleted || 0) - Number(left.missionsCompleted || 0);
    })
    .map((volunteer, index) => ({
      ...volunteer,
      rewardRankings: {
        ...(volunteer.rewardRankings || {}),
        [period]: index + 1
      }
    }));
  res.json(leaderboard);
}

async function getVolunteerProfile(req, res) {
  try {
    const volunteers = await getVolunteers();
    const volunteer = volunteers.find(
      (entry) => String(entry.createdBy || '') === String(req.user.uid)
        || String(entry.email || '').toLowerCase() === String(req.user.email || '').toLowerCase()
    );

    return res.json({ success: true, volunteer: volunteer || null });
  } catch (error) {
    console.error('Volunteer profile fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load volunteer profile' });
  }
}

async function createVolunteer(req, res) {
  const volunteers = await getVolunteers();
  const existingVolunteer = volunteers.find(
    (entry) => String(entry.createdBy || '') === String(req.user.uid)
      || String(entry.email || '').toLowerCase() === String(req.user.email || '').toLowerCase()
  );

  if (existingVolunteer) {
    return res.status(409).json({ success: false, error: 'Volunteer profile already exists for this account' });
  }

  const profile = await getUserProfile(req.user.uid);
  const newVolunteer = enrichVolunteer({
    id: `v${Date.now()}`,
    ...req.body,
    certifications: req.body.certifications || profile?.training?.badges || [],
    createdBy: req.user.uid,
    email: req.user.email || ''
  });
  await setDocument('volunteers', newVolunteer.id, newVolunteer);
  await logAuditEvent({
    actor: {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      source: 'volunteer-portal'
    },
    action: 'volunteer_created',
    entityType: 'volunteer',
    entityId: newVolunteer.id,
    summary: `${newVolunteer.name} joined the volunteer roster.`,
      metadata: {
        skill: newVolunteer.skill,
      location: newVolunteer.location,
      organizationId: newVolunteer.organizationId
      },
    severity: 'info'
  });
  res.status(201).json(newVolunteer);
}

async function updateVolunteerProfile(req, res) {
  try {
    const volunteers = await getVolunteers();
    const existingVolunteer = volunteers.find(
      (entry) => String(entry.createdBy || '') === String(req.user.uid)
        || String(entry.email || '').toLowerCase() === String(req.user.email || '').toLowerCase()
    );

    if (!existingVolunteer) {
      return res.status(404).json({ success: false, error: 'Volunteer profile not found' });
    }

    const profile = await getUserProfile(req.user.uid);
    const updatedVolunteer = enrichVolunteer({
      ...existingVolunteer,
      name: req.body.name ?? existingVolunteer.name,
      skill: req.body.skill ?? existingVolunteer.skill,
      location: req.body.location ?? existingVolunteer.location,
      radius: Number(req.body.radius ?? existingVolunteer.radius) || 5,
      organizationId: req.body.organizationId ?? existingVolunteer.organizationId,
      organizationName: req.body.organizationName ?? existingVolunteer.organizationName,
      organizationShortName: req.body.organizationShortName ?? existingVolunteer.organizationShortName,
      certifications: existingVolunteer.certifications?.length
        ? existingVolunteer.certifications
        : (profile?.training?.badges || []),
      updatedAt: new Date().toISOString()
    });

    await setDocument('volunteers', updatedVolunteer.id, updatedVolunteer);
    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        source: 'volunteer-portal'
      },
      action: 'volunteer_updated',
      entityType: 'volunteer',
      entityId: updatedVolunteer.id,
      summary: `${updatedVolunteer.name} updated their volunteer profile.`,
      metadata: {
        skill: updatedVolunteer.skill,
        location: updatedVolunteer.location,
        radius: updatedVolunteer.radius
      },
      severity: 'info'
    });

    return res.json({ success: true, volunteer: updatedVolunteer });
  } catch (error) {
    console.error('Volunteer profile update error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update volunteer profile' });
  }
}

async function deleteVolunteerProfile(req, res) {
  try {
    const volunteers = await getVolunteers();
    const existingVolunteer = volunteers.find(
      (entry) => String(entry.createdBy || '') === String(req.user.uid)
        || String(entry.email || '').toLowerCase() === String(req.user.email || '').toLowerCase()
    );

    if (!existingVolunteer) {
      return res.status(404).json({ success: false, error: 'Volunteer profile not found' });
    }

    await deleteDocument('volunteers', existingVolunteer.id);
    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        source: 'volunteer-portal'
      },
      action: 'volunteer_deleted',
      entityType: 'volunteer',
      entityId: existingVolunteer.id,
      summary: `${existingVolunteer.name} deleted their volunteer profile.`,
      metadata: {
        skill: existingVolunteer.skill,
        location: existingVolunteer.location
      },
      severity: 'warning'
    });

    return res.json({ success: true, deletedId: existingVolunteer.id });
  } catch (error) {
    console.error('Volunteer profile delete error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete volunteer profile' });
  }
}

module.exports = {
  createVolunteer,
  deleteVolunteerProfile,
  getVolunteerProfile,
  listVolunteers,
  updateVolunteerProfile
};
