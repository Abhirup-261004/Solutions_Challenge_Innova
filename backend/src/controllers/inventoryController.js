const { buildInventoryRecord, setDocument } = require('../models/dataStore');
const { getInventory, logAuditEvent } = require('../services/operationsService');

async function listInventory(req, res) {
  try {
    const inventory = await getInventory();
    return res.json(inventory.sort((left, right) => String(left.name).localeCompare(String(right.name))));
  } catch (error) {
    console.error('Inventory fetch error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch inventory' });
  }
}

async function createInventoryItem(req, res) {
  try {
    const item = buildInventoryRecord(req.body, req.user.uid);
    await setDocument('inventory', item.id, item);
    await logAuditEvent({
      actor: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        source: 'inventory'
      },
      action: 'inventory_item_created',
      entityType: 'inventory',
      entityId: item.id,
      summary: `${item.name} added to inventory at ${item.location}.`,
      metadata: {
        quantity: item.quantity,
        threshold: item.threshold,
        category: item.category
      },
      severity: item.status === 'low' ? 'warning' : 'info'
    });

    return res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Inventory create error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create inventory item' });
  }
}

module.exports = {
  createInventoryItem,
  listInventory
};
