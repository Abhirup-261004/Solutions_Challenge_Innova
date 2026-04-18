import { Mail, MessageSquareText } from 'lucide-react';

export default function DispatchFeed({ logs }) {
  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h3>Dispatch Activity</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Mock email and SMS workflows for presentation-ready operations.</p>
        </div>
        <MessageSquareText size={18} color="var(--accent-cyan)" />
      </div>

      <div style={{ display: 'grid', gap: '0.85rem' }}>
        {logs.length === 0 ? <p className="text-muted">No dispatch activity recorded yet.</p> : null}
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: '0.85rem',
              alignItems: 'center',
              padding: '0.95rem 1rem',
              borderRadius: '14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--glass-border)'
            }}
          >
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'rgba(0,240,255,0.1)' }}>
              <Mail size={15} color="var(--accent-cyan)" />
            </div>
            <div>
              <p style={{ fontWeight: 600 }}>{log.summary}</p>
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>{log.target}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--accent-green)' }}>{log.status}</p>
              <p className="text-muted" style={{ fontSize: '0.74rem', marginTop: '0.2rem' }}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
