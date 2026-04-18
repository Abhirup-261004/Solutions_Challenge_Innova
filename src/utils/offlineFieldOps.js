export const OFFLINE_FIELD_OPS_QUEUE_KEY = 'resourcesync_offline_field_ops_queue';

export function readOfflineFieldOpsQueue() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(OFFLINE_FIELD_OPS_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function writeOfflineFieldOpsQueue(queue) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(OFFLINE_FIELD_OPS_QUEUE_KEY, JSON.stringify(queue));
}

export function queueOfflineFieldOp(item) {
  const queue = readOfflineFieldOpsQueue();
  queue.push({
    id: `field-op-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    ...item
  });
  writeOfflineFieldOpsQueue(queue);
  return queue;
}

export function applyOfflineFieldOp(items, operation) {
  return items.map((item) => {
    if (String(item.assignmentId) !== String(operation.assignmentId)) {
      return item;
    }

    if (operation.type === 'status') {
      return {
        ...item,
        status: operation.payload.status,
        statusLabel: formatAssignmentStatus(operation.payload.status),
        offlinePending: true,
        lastOfflineAction: `Status queued as ${formatAssignmentStatus(operation.payload.status)}`
      };
    }

    if (operation.type === 'evidence') {
      const evidenceEntry = {
        id: operation.previewId || `offline-evidence-${Date.now()}`,
        ...operation.payload,
        pendingSync: true,
        uploadedAt: operation.payload.uploadedAt || new Date().toISOString()
      };

      return {
        ...item,
        evidence: [...(Array.isArray(item.evidence) ? item.evidence : []), evidenceEntry],
        offlinePending: true,
        lastOfflineAction: 'Evidence queued for sync'
      };
    }

    return item;
  });
}

export function formatAssignmentStatus(status) {
  return String(status || 'pending')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}
