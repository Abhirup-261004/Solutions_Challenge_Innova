const { getNeedById, getEscalatedNeeds, logAuditEvent } = require('../services/operationsService');
const { setDocument } = require('../models/dataStore');

async function listEscalations(req, res) {
  try {
    const orgId = req.query.orgId && req.query.orgId !== 'all' ? String(req.query.orgId) : null;
    const escalations = await getEscalatedNeeds({
      uid: req.user?.uid,
      email: req.user?.email,
      role: req.user?.role,
      source: 'dashboard'
    });

    return res.json(orgId ? escalations.filter((need) => String(need.organizationId) === orgId) : escalations);
  } catch (error) {
    console.error('Escalations fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch escalations' });
  }
}

async function acknowledgeEscalation(req, res) {
  try {
    if (!['admin', 'coordinator'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, error: 'Only admins and coordinators can acknowledge escalations' });
    }

    const need = await getNeedById(req.params.id);
    if (!need) {
      return res.status(404).json({ success: false, error: 'Need not found' });
    }

    const currentEscalation = need.escalation || {};
    const nextNeed = {
      ...need,
      escalation: {
        ...currentEscalation,
        status: 'acknowledged',
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: {
          uid: req.user.uid,
          email: req.user.email,
          role: req.user.role
        }
      }
    };

    await setDocument('needs', String(need.id), nextNeed);

    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        source: 'dashboard'
      },
      action: 'need_escalation_acknowledged',
      entityType: 'need',
      entityId: need.id,
      summary: `${need.title} escalation was acknowledged.`,
      metadata: {
        level: currentEscalation.level || null,
        trigger: currentEscalation.trigger || null
      },
      severity: 'medium'
    });

    return res.json({ success: true, escalation: nextNeed.escalation });
  } catch (error) {
    console.error('Escalation acknowledge error:', error);
    return res.status(500).json({ success: false, error: 'Failed to acknowledge escalation' });
  }
}

module.exports = {
  acknowledgeEscalation,
  listEscalations
};
