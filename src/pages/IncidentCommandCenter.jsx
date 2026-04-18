import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  BriefcaseMedical,
  Clock3,
  Gauge,
  Layers3,
  RadioTower,
  ShieldAlert,
  Siren,
  Sparkles,
  Users,
  Warehouse
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getJson, normalizeArray } from '../utils/api';

const emptyCommand = {
  incident: null,
  summary: {},
  readiness: { score: 0, label: '', narrative: '' },
  leadershipBrief: '',
  categoryMix: [],
  zones: [],
  recommendations: [],
  phaseTracker: [],
  organizationBreakdown: [],
  responseHealth: [],
  needs: [],
  escalations: [],
  assignments: [],
  inventory: [],
  networkRequests: [],
  notifications: [],
  timeline: []
};

const pieColors = ['#00f0ff', '#00ff88', '#ff9500', '#8a2be2', '#ff5c8a', '#7dd3fc'];

function MetricCard({ icon, label, value, detail, accent }) {
  return (
    <div className="glass-panel" style={{ padding: '1.2rem', display: 'grid', gap: '0.8rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
        <div
          style={{
            width: '2.9rem',
            height: '2.9rem',
            borderRadius: '18px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            color: accent
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Live</span>
      </div>
      <div>
        <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
        <h2 style={{ fontSize: '2rem', marginTop: '0.2rem' }}>{value}</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>{detail}</p>
      </div>
    </div>
  );
}

function ChartShell({ title, subtitle, children, height = 280 }) {
  return (
    <div className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '1rem' }}>
      <div>
        <h3>{title}</h3>
        <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.24rem' }}>{subtitle}</p>
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div style={{ background: 'rgba(10,14,24,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '0.7rem 0.85rem' }}>
      <p style={{ fontWeight: 700 }}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name || entry.dataKey} style={{ color: entry.color || 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.18rem' }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="glass-panel" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)' }}>
      <p className="text-muted">{label}</p>
    </div>
  );
}

function severityTone(value = '') {
  if (value === 'Critical' || value === 'critical') return 'var(--accent-red)';
  if (value === 'High' || value === 'high') return 'var(--accent-orange)';
  if (value === 'Medium' || value === 'warning') return 'var(--accent-cyan)';
  return 'var(--accent-green)';
}

function progressTone(value = 0) {
  if (value < 45) return 'var(--accent-red)';
  if (value < 70) return 'var(--accent-orange)';
  return 'var(--accent-green)';
}

function priorityTone(value = '') {
  if (value === 'critical') return { bg: 'rgba(255,59,48,0.14)', color: 'var(--accent-red)' };
  if (value === 'high') return { bg: 'rgba(255,149,0,0.14)', color: 'var(--accent-orange)' };
  if (value === 'watch') return { bg: 'rgba(0,240,255,0.12)', color: 'var(--accent-cyan)' };
  return { bg: 'rgba(0,255,136,0.12)', color: 'var(--accent-green)' };
}

export default function IncidentCommandCenter() {
  const { getToken } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [command, setCommand] = useState(emptyCommand);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Loading incident command view...');

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const token = await getToken();
        const data = await getJson('/api/incidents', { token });
        const rows = data.success ? normalizeArray(data.incidents) : [];
        setIncidents(rows);
        setSelectedIncidentId((current) => current || rows[0]?.id || '');
      } catch (error) {
        console.error(error);
        setMessage(`Unable to load incidents. ${error.message}`);
      }
    };

    fetchIncidents();
  }, []);

  useEffect(() => {
    if (!selectedIncidentId) {
      setCommand(emptyCommand);
      setLoading(false);
      return;
    }

    const fetchCommand = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const data = await getJson(`/api/incidents/${encodeURIComponent(selectedIncidentId)}/command`, { token });
        setCommand(data);
        setMessage(`${data.incident?.name || 'Incident'} is active in the command room.`);
      } catch (error) {
        console.error(error);
        setCommand(emptyCommand);
        setMessage(`Incident command view failed to load. ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchCommand();
  }, [selectedIncidentId]);

  const summaryCards = useMemo(() => ([
    {
      label: 'Live Needs',
      value: command.summary?.liveNeeds || 0,
      detail: 'Open needs grouped under the selected incident.',
      icon: <BriefcaseMedical size={20} />,
      accent: 'var(--accent-cyan)'
    },
    {
      label: 'Escalations',
      value: command.summary?.escalatedNeeds || 0,
      detail: 'Cases already in the command escalation queue.',
      icon: <Siren size={20} />,
      accent: 'var(--accent-red)'
    },
    {
      label: 'Coverage',
      value: `${command.summary?.coverageRate || 0}%`,
      detail: `${command.summary?.openSpots || 0} open volunteer slots remain.`,
      icon: <Users size={20} />,
      accent: 'var(--accent-green)'
    },
    {
      label: 'Resource Pressure',
      value: command.summary?.lowInventoryCount || 0,
      detail: 'Inventory lines currently under threshold.',
      icon: <Warehouse size={20} />,
      accent: 'var(--accent-orange)'
    }
  ]), [command.summary]);

  const selectedIncident = command.incident;
  const readinessTone = progressTone(command.readiness?.score || 0);

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '1.8rem' }}>
      <section className="glass-panel" style={{ padding: 'clamp(1.5rem, 4vw, 2.3rem)', background: 'linear-gradient(135deg, rgba(255,59,48,0.08), rgba(8,12,20,0.92) 42%, rgba(0,240,255,0.08))' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)', gap: '1.3rem', alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: '0.95rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.42rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
              <ShieldAlert size={16} color="var(--accent-red)" />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Incident Command Mode</span>
            </div>
            <div>
              <h1 className="text-gradient">Incident Command Center</h1>
              <p className="text-muted" style={{ marginTop: '0.55rem', maxWidth: '70ch' }}>
                A dedicated executive coordination page for active incidents. It combines live needs, escalations, staffing pressure, mutual aid, and operational history into one briefing surface.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/dashboard" className="btn-secondary">Mission Control</Link>
              <Link to="/network" className="btn-secondary">Network Ops</Link>
              <Link to="/analytics" className="btn-primary">Analytics</Link>
            </div>
            <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>{message}</p>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '0.85rem' }}>
            <div>
              <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Incident</p>
              <p style={{ marginTop: '0.25rem', fontSize: '0.92rem' }}>Choose the scenario leadership wants to brief and manage.</p>
            </div>
            <select
              className="input-field"
              value={selectedIncidentId}
              onChange={(event) => setSelectedIncidentId(event.target.value)}
              style={{ appearance: 'none' }}
            >
              {incidents.map((incident) => (
                <option key={incident.id} value={incident.id}>
                  {incident.name} ({incident.code})
                </option>
              ))}
            </select>
            {selectedIncident ? (
              <div className="glass-panel" style={{ padding: '0.9rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.45rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center' }}>
                  <p style={{ fontWeight: 700 }}>{selectedIncident.code}</p>
                  <span style={{ padding: '0.3rem 0.72rem', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: severityTone(selectedIncident.severity), fontSize: '0.76rem', fontWeight: 700 }}>
                    {selectedIncident.severity}
                  </span>
                </div>
                <p className="text-muted" style={{ fontSize: '0.84rem' }}>{selectedIncident.location} • {selectedIncident.zone}</p>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>Commander: {selectedIncident.commander || 'Unassigned'}</p>
              </div>
            ) : null}
            <div className="glass-panel" style={{ padding: '0.95rem', background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', display: 'grid', gap: '0.55rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center' }}>
                <p style={{ fontWeight: 700 }}>Command Readiness</p>
                <span style={{ color: readinessTone, fontWeight: 800 }}>{command.readiness?.score || 0}/100</span>
              </div>
              <div style={{ height: '0.65rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${Math.max(0, Math.min(command.readiness?.score || 0, 100))}%`, height: '100%', background: `linear-gradient(90deg, ${readinessTone}, rgba(255,255,255,0.9))` }} />
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {command.readiness?.label || 'Unknown'} posture. {command.readiness?.narrative || 'Readiness details will appear here.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: '1.3rem' }}>
        <div className="glass-panel" style={{ padding: '1.35rem', display: 'grid', gap: '1rem', background: 'linear-gradient(135deg, rgba(0,240,255,0.05), rgba(255,255,255,0.02))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Sparkles size={18} color="var(--accent-cyan)" />
            <h3 style={{ margin: 0 }}>Recommended Next Actions</h3>
          </div>
          {!command.recommendations.length ? <EmptyState label="Command recommendations will appear when enough incident signal is available." /> : null}
          {command.recommendations.map((action) => {
            const tone = priorityTone(action.priority);
            return (
              <div key={action.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'start' }}>
                  <p style={{ fontWeight: 700 }}>{action.title}</p>
                  <span style={{ padding: '0.28rem 0.68rem', borderRadius: '999px', background: tone.bg, color: tone.color, fontSize: '0.75rem', fontWeight: 700 }}>
                    {action.priority}
                  </span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>{action.detail}</p>
              </div>
            );
          })}
        </div>

        <div className="glass-panel" style={{ padding: '1.35rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Layers3 size={18} color="var(--accent-purple)" />
            <h3 style={{ margin: 0 }}>Incident Phase Tracker</h3>
          </div>
          {!command.phaseTracker.length ? <EmptyState label="No phase sequence is defined for this incident." /> : null}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(command.phaseTracker.length, 1)}, minmax(0, 1fr))`, gap: '0.8rem' }}>
            {command.phaseTracker.map((phase) => {
              const isComplete = phase.status === 'complete';
              const isActive = phase.status === 'active';
              return (
                <div key={phase.id} className="glass-panel" style={{ padding: '0.95rem 0.85rem', background: isActive ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.02)', border: isActive ? '1px solid rgba(0,240,255,0.28)' : '1px solid var(--glass-border)', display: 'grid', gap: '0.45rem' }}>
                  <span style={{ width: '1.75rem', height: '1.75rem', borderRadius: '999px', display: 'grid', placeItems: 'center', background: isComplete ? 'rgba(0,255,136,0.15)' : isActive ? 'rgba(0,240,255,0.16)' : 'rgba(255,255,255,0.06)', color: isComplete ? 'var(--accent-green)' : isActive ? 'var(--accent-cyan)' : 'var(--text-muted)', fontWeight: 800 }}>
                    {isComplete ? '✓' : isActive ? '•' : '○'}
                  </span>
                  <p style={{ fontWeight: 700 }}>{phase.label}</p>
                  <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{phase.status}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: '1.3rem' }}>
        <div className="glass-panel" style={{ padding: '1.35rem', display: 'grid', gap: '0.95rem' }}>
          <div>
            <h3>Leadership Brief</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              A fast summary of the current incident picture for demos and command briefings.
            </p>
          </div>
          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
            <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {loading ? 'Preparing the command briefing...' : (command.leadershipBrief || 'No incident briefing is available yet.')}
            </p>
          </div>
          {selectedIncident?.objectives?.length ? (
            <div style={{ display: 'grid', gap: '0.7rem' }}>
              {selectedIncident.objectives.map((objective, index) => (
                <div key={`${selectedIncident.id}-objective-${index}`} className="glass-panel" style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                  <p style={{ fontWeight: 600 }}>{objective}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="glass-panel" style={{ padding: '1.35rem', display: 'grid', gap: '0.95rem' }}>
          <div>
            <h3>Command Parameters</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              Core incident metadata that frames the response plan.
            </p>
          </div>
          {selectedIncident ? (
            <div style={{ display: 'grid', gap: '0.7rem' }}>
              {[
                { label: 'Status', value: selectedIncident.status },
                { label: 'Affected Population', value: command.summary?.affectedPopulation || 0 },
                { label: 'Target Resolution', value: `${selectedIncident.targetResolutionHours || 0}h` },
                { label: 'Mutual Aid', value: command.summary?.activeMutualAidRequests || 0 }
              ].map((row) => (
                <div key={row.label} className="glass-panel" style={{ padding: '0.85rem 0.95rem', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                  <span className="text-muted" style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{row.label}</span>
                  <span style={{ fontWeight: 700 }}>{row.value}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState label="Select an incident to load command parameters." />}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {(command.responseHealth || []).map((metric) => (
          <div key={metric.label} className="glass-panel" style={{ padding: '1.1rem', display: 'grid', gap: '0.6rem', background: 'rgba(255,255,255,0.025)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
              <p style={{ fontWeight: 700 }}>{metric.label}</p>
              <span style={{ color: progressTone(metric.value), fontWeight: 800 }}>{metric.value}</span>
            </div>
            <div style={{ height: '0.55rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(0, Math.min(metric.value, 100))}%`, height: '100%', background: progressTone(metric.value) }} />
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>{metric.detail}</p>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.3rem' }}>
        <ChartShell
          title="Demand Mix"
          subtitle="Which categories are driving the current incident workload."
          height={300}
        >
          {command.categoryMix.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={command.categoryMix} dataKey="value" nameKey="label" innerRadius={62} outerRadius={94} paddingAngle={4}>
                  {command.categoryMix.map((entry, index) => (
                    <Cell key={`${entry.label}-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState label="No category mix is available for this incident yet." />}
        </ChartShell>

        <ChartShell
          title="Zone Pressure"
          subtitle="Open needs and staffing gaps by operational zone."
          height={300}
        >
          {command.zones.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={command.zones}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="zone" stroke="rgba(255,255,255,0.55)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.55)" tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="liveNeeds" name="Live Needs" fill="#00f0ff" radius={[8, 8, 0, 0]} />
                <Bar dataKey="openSpots" name="Open Spots" fill="#ff9500" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState label="Zone pressure will appear once incident needs are available." />}
        </ChartShell>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)', gap: '1.3rem' }}>
        <div className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Building2 size={18} color="var(--accent-cyan)" />
            <h3 style={{ margin: 0 }}>Organization Contribution Board</h3>
          </div>
          {!command.organizationBreakdown.length ? <EmptyState label="Organization contribution data will appear once incident-linked operations are available." /> : null}
          {command.organizationBreakdown.map((row) => (
            <div key={row.organizationId} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '0.7rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{row.organizationName}</p>
                  <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.14rem' }}>{row.organizationShortName}</p>
                </div>
                <span style={{ padding: '0.32rem 0.68rem', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 }}>
                  {row.activeAssignments} active
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.6rem' }}>
                {[
                  { label: 'Needs', value: row.liveNeeds },
                  { label: 'Gaps', value: row.openSpots },
                  { label: 'Escal.', value: row.escalations },
                  { label: 'Low Inv.', value: row.lowInventory },
                  { label: 'Aid', value: row.mutualAid }
                ].map((stat) => (
                  <div key={`${row.organizationId}-${stat.label}`} className="glass-panel" style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</p>
                    <p style={{ fontWeight: 700, marginTop: '0.14rem' }}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,240,255,0.04))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Gauge size={18} color="var(--accent-orange)" />
            <h3 style={{ margin: 0 }}>Executive Watchpoints</h3>
          </div>
          {[
            {
              label: 'Critical Queue',
              value: command.summary?.criticalNeeds || 0,
              detail: 'Needs that are already in the highest-urgency band.'
            },
            {
              label: 'Open Coverage Gaps',
              value: command.summary?.openSpots || 0,
              detail: 'Volunteer roles that still need to be filled.'
            },
            {
              label: 'Mutual Aid in Motion',
              value: command.summary?.activeMutualAidRequests || 0,
              detail: 'Cross-organization workflows contributing to the response.'
            },
            {
              label: 'Affected Population',
              value: command.summary?.affectedPopulation || 0,
              detail: 'Current scale of impact associated with the incident.'
            }
          ].map((watch) => (
            <div key={watch.label} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '0.3rem' }}>
              <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{watch.label}</p>
              <p style={{ fontSize: '1.55rem', fontWeight: 800 }}>{watch.value}</p>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>{watch.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: '1.3rem' }}>
        <div className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Escalation Queue</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              Highest-risk items attached to this incident, ordered by urgency and command score.
            </p>
          </div>
          {!command.escalations.length ? <EmptyState label="No escalations are currently open for this incident." /> : null}
          {command.escalations.map((need, index) => (
            <div key={need.id || `${need.title}-${index}`} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.024)', display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{need.title}</p>
                  <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.18rem' }}>{need.location} • {need.category} • {need.urgency}</p>
                </div>
                <span style={{ padding: '0.34rem 0.72rem', borderRadius: '999px', background: 'rgba(255,59,48,0.12)', color: 'var(--accent-red)', fontSize: '0.76rem', fontWeight: 700 }}>
                  {need.escalation?.score || 0}/100
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{need.escalation?.trigger}</p>
              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                {(need.escalation?.reasons || []).slice(0, 3).map((reason, reasonIndex) => (
                  <span key={`${need.id}-reason-${reasonIndex}`} style={{ padding: '0.34rem 0.7rem', borderRadius: '999px', background: 'rgba(255,255,255,0.045)', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Resource Pressure</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              Inventory linked to this incident, highlighting threshold risk and stock readiness.
            </p>
          </div>
          {!command.inventory.length ? <EmptyState label="No linked inventory is available for this incident." /> : null}
          {command.inventory.map((item) => {
            const isLow = Number(item.quantity || 0) <= Number(item.threshold || 0);
            return (
              <div key={item.id} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{item.name}</p>
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.16rem' }}>{item.location} • {item.unit}</p>
                  </div>
                  <span style={{ padding: '0.32rem 0.68rem', borderRadius: '999px', background: isLow ? 'rgba(255,149,0,0.14)' : 'rgba(0,255,136,0.12)', color: isLow ? 'var(--accent-orange)' : 'var(--accent-green)', fontSize: '0.76rem', fontWeight: 700 }}>
                    {isLow ? 'Low' : 'Healthy'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.86rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Stock {item.quantity}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Threshold {item.threshold}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.98fr) minmax(0, 1.02fr)', gap: '1.3rem' }}>
        <div className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Mutual Aid Workflow</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              Cross-organization support actions that are helping this incident response.
            </p>
          </div>
          {!command.networkRequests.length ? <EmptyState label="No mutual-aid requests are attached to this incident yet." /> : null}
          {command.networkRequests.map((request) => (
            <div key={request.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'start' }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{request.summary}</p>
                  <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.18rem' }}>
                    {request.requestingOrganizationShortName} to {request.supportingOrganizationShortName}
                  </p>
                </div>
                <span style={{ padding: '0.32rem 0.68rem', borderRadius: '999px', background: 'rgba(0,240,255,0.12)', color: 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 }}>
                  {String(request.status || 'requested').replaceAll('_', ' ')}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                {request.transfer?.quantity || request.suggestedUnits || 0} {request.transfer?.unit || 'units'} • {request.transfer?.mode || 'coordination pending'}
              </p>
            </div>
          ))}
        </div>

        <div className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Operational Timeline</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              A compact audit-style feed of command activity for this incident.
            </p>
          </div>
          {!command.timeline.length ? <EmptyState label="Timeline activity will appear as incident events are logged." /> : null}
          {command.timeline.map((entry) => (
            <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.85rem' }}>
              <div style={{ width: '2.2rem', display: 'grid', justifyItems: 'center' }}>
                <div style={{ width: '0.78rem', height: '0.78rem', borderRadius: '999px', marginTop: '0.35rem', background: severityTone(entry.severity) }} />
                <div style={{ width: '1px', flex: 1, background: 'rgba(255,255,255,0.1)', minHeight: '2.6rem' }} />
              </div>
              <div className="glass-panel" style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.02)', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'start' }}>
                  <p style={{ fontWeight: 700 }}>{entry.title}</p>
                  <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Now'}
                  </span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>{entry.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.2rem' }}>
        <div className="glass-panel" style={{ padding: '1.3rem', display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle size={18} color="var(--accent-orange)" />
            <h3 style={{ margin: 0 }}>Open Needs Snapshot</h3>
          </div>
          {!command.needs.length ? <EmptyState label="No needs are linked to this incident yet." /> : null}
          {command.needs.slice(0, 5).map((need) => (
            <div key={need.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 600 }}>{need.title}</p>
                <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.14rem' }}>{need.location} • {need.category}</p>
              </div>
              <span style={{ color: severityTone(need.urgency), fontWeight: 700 }}>{need.openSpots || 0}</span>
            </div>
          ))}
        </div>

        <div className="glass-panel" style={{ padding: '1.3rem', display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <ArrowRightLeft size={18} color="var(--accent-cyan)" />
            <h3 style={{ margin: 0 }}>Assignments In Motion</h3>
          </div>
          {!command.assignments.length ? <EmptyState label="No active assignment records are attached to this incident." /> : null}
          {command.assignments.slice(0, 5).map((assignment) => (
            <div key={assignment.id} style={{ display: 'grid', gap: '0.16rem' }}>
              <p style={{ fontWeight: 600 }}>{assignment.volunteerName}</p>
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>{assignment.needTitle}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{assignment.status} • {assignment.volunteerSkill}</p>
            </div>
          ))}
        </div>

        <div className="glass-panel" style={{ padding: '1.3rem', display: 'grid', gap: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <RadioTower size={18} color="var(--accent-purple)" />
            <h3 style={{ margin: 0 }}>Recent Alerts</h3>
          </div>
          {!command.notifications.length ? <EmptyState label="No incident-specific notifications are available yet." /> : null}
          {command.notifications.slice(0, 5).map((notification) => (
            <div key={notification.id} style={{ display: 'grid', gap: '0.16rem' }}>
              <p style={{ fontWeight: 600 }}>{notification.title}</p>
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>{notification.message}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
