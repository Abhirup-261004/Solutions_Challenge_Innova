const { getAuditLogs } = require('../services/operationsService');

async function listAuditLogs(req, res) {
  try {
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
  } catch (error) {
    console.error('Audit trail fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit trail' });
  }
}

module.exports = {
  listAuditLogs
};
