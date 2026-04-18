const { buildOperationsInsights } = require('../services/operationsService');

async function getOperationsInsights(req, res) {
  try {
    const insights = await buildOperationsInsights();
    return res.json({ success: true, ...insights });
  } catch (error) {
    console.error('Operations insights error:', error);
    return res.status(500).json({ success: false, error: 'Failed to load operations insights' });
  }
}

module.exports = {
  getOperationsInsights
};
