const assignmentStatuses = ['pending', 'accepted', 'en_route', 'completed'];

function summarizeStatus(status) {
  if (status === 'en_route') return 'En Route';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function canManageAssignmentsForRole(role = 'viewer') {
  return ['admin', 'coordinator'].includes(role);
}

function canAccessIntakeForRole(role = 'viewer') {
  return ['admin', 'coordinator'].includes(role);
}

module.exports = {
  assignmentStatuses,
  canAccessIntakeForRole,
  canManageAssignmentsForRole,
  summarizeStatus
};
