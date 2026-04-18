import { AlertTriangle, Bell, CheckCheck, MessageSquareWarning, ScanSearch, UserCheck } from 'lucide-react';

const notificationMeta = {
  urgent_need: {
    icon: AlertTriangle,
    color: 'var(--accent-orange)'
  },
  assignment_accepted: {
    icon: UserCheck,
    color: 'var(--accent-green)'
  },
  ocr_failure: {
    icon: ScanSearch,
    color: 'var(--accent-red)'
  },
  sms_intake: {
    icon: MessageSquareWarning,
    color: 'var(--accent-cyan)'
  },
  review_queue: {
    icon: Bell,
    color: 'var(--accent-purple)'
  }
};

export default function NotificationsPanel({ notifications, unreadCount, onMarkRead, onMarkAllRead, markingNotificationId }) {
  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Bell size={18} color="var(--accent-cyan)" />
            Notifications Center
          </h3>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
            In-app alerts for urgent needs, assignment acceptance, OCR failures, and SMS intake.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: unreadCount ? 'var(--accent-orange)' : 'var(--text-secondary)', fontWeight: 700 }}>
            {unreadCount} unread
          </span>
          <button type="button" className="btn-secondary" onClick={onMarkAllRead} style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <CheckCheck size={15} />
            Mark all read
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.85rem' }}>
        {notifications.length === 0 ? <p className="text-muted">No notifications yet.</p> : null}
        {notifications.map((notification) => {
          const meta = notificationMeta[notification.type] || notificationMeta.sms_intake;
          const Icon = meta.icon;

          return (
            <div
              key={notification.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: '0.85rem',
                alignItems: 'center',
                padding: '1rem',
                borderRadius: '16px',
                background: notification.read ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)',
                border: `1px solid ${notification.read ? 'var(--glass-border)' : 'rgba(0,240,255,0.16)'}`
              }}
            >
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                <Icon size={16} color={meta.color} />
              </div>

              <div>
                <p style={{ fontWeight: 700 }}>{notification.title}</p>
                <p className="text-muted" style={{ fontSize: '0.86rem', marginTop: '0.2rem' }}>{notification.message}</p>
              </div>

              <div style={{ textAlign: 'right', display: 'grid', gap: '0.45rem', justifyItems: 'end' }}>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {!notification.read ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onMarkRead(notification.id)}
                    disabled={markingNotificationId === notification.id}
                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  >
                    {markingNotificationId === notification.id ? 'Saving...' : 'Mark read'}
                  </button>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-green)', fontWeight: 700 }}>Read</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
