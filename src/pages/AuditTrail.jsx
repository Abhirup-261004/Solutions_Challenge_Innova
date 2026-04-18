import { useEffect, useMemo, useState } from 'react';
import { ActivitySquare, Filter, LoaderCircle, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

const severityStyles = {
  info: {
    color: 'var(--accent-cyan)',
    background: 'rgba(0,240,255,0.1)'
  },
  warning: {
    color: 'var(--accent-orange)',
    background: 'rgba(255,149,0,0.12)'
  },
  high: {
    color: 'var(--accent-red)',
    background: 'rgba(255,59,48,0.12)'
  }
};

export default function AuditTrail() {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');

      try {
        const token = await getToken();
        const response = await fetch('http://localhost:8000/api/audit-logs?limit=100', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch audit logs');
        }

        setLogs(normalizeArray(data));
      } catch (fetchError) {
        console.error(fetchError);
        setError(fetchError.message || 'Unable to load audit trail.');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [getToken]);

  const entityTypes = useMemo(
    () => ['all', ...new Set(logs.map((log) => log.entityType).filter(Boolean))],
    [logs]
  );

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => severityFilter === 'all' || log.severity === severityFilter)
      .filter((log) => entityFilter === 'all' || log.entityType === entityFilter);
  }, [entityFilter, logs, severityFilter]);

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '2rem' }}>
      <section
        className="glass-panel"
        style={{
          padding: '1.8rem',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(300px, 0.85fr)',
          gap: '1.5rem',
          background: 'linear-gradient(140deg, rgba(0,240,255,0.08), rgba(8,12,20,0.88) 46%, rgba(255,149,0,0.06))'
        }}
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
            <ShieldCheck size={16} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Operational accountability</span>
          </div>
          <div>
            <h1 className="text-gradient">Audit Trail</h1>
            <p className="text-muted" style={{ marginTop: '0.5rem', maxWidth: '62ch' }}>
              A tamper-evident style activity log showing who changed what, when it happened, and which operational record was affected.
            </p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--accent-cyan)" />
            <p style={{ fontWeight: 700 }}>Filter the trail</p>
          </div>
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="input-field" style={{ appearance: 'none' }}>
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="high">High</option>
          </select>
          <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} className="input-field" style={{ appearance: 'none' }}>
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType === 'all' ? 'All entity types' : entityType}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
          <LoaderCircle size={20} className="spinning" color="var(--accent-cyan)" />
          <span className="text-muted">Loading audit history...</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="glass-panel" style={{ padding: '1.3rem', borderColor: 'rgba(255,59,48,0.28)', background: 'rgba(255,59,48,0.05)' }}>
          <p style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{error}</p>
        </div>
      ) : null}

      <section className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3>Recorded events</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              {filteredLogs.length} event{filteredLogs.length === 1 ? '' : 's'} match the current filters.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.85rem' }}>
          {!loading && !filteredLogs.length ? <p className="text-muted">No audit records match the current filters.</p> : null}
          {filteredLogs.map((log) => {
            const severity = severityStyles[log.severity] || severityStyles.info;
            return (
              <div
                key={log.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  gap: '0.9rem',
                  alignItems: 'start',
                  padding: '1rem',
                  borderRadius: '16px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.025)'
                }}
              >
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '16px', display: 'grid', placeItems: 'center', background: severity.background, color: severity.color }}>
                  <ActivitySquare size={16} />
                </div>

                <div style={{ display: 'grid', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>{log.summary}</span>
                    <span style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', background: severity.background, color: severity.color, fontSize: '0.76rem', fontWeight: 700 }}>
                      {String(log.severity || 'info').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.84rem' }}>
                    Action: {log.action} • Entity: {log.entityType} {log.entityId ? `• ID: ${log.entityId}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <UserRound size={14} />
                      {log.actor?.email || log.actor?.uid || 'system'}
                    </span>
                    <span>{log.actor?.role || 'system'}</span>
                    <span>{log.actor?.source || 'api'}</span>
                  </div>
                  {log.metadata && Object.keys(log.metadata).length ? (
                    <div className="glass-panel" style={{ padding: '0.8rem 0.9rem', background: 'rgba(255,255,255,0.02)' }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>

                <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Unknown time'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
