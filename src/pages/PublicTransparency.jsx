import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Globe2,
  HeartHandshake,
  LoaderCircle,
  MapPinned,
  ShieldCheck,
  Users
} from 'lucide-react';
import {
  Area,
  AreaChart,
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

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatStatus(status) {
  return String(status || 'unknown')
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function countBy(items, accessor) {
  const grouped = items.reduce((accumulator, item) => {
    const key = accessor(item);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      style={{
        background: 'rgba(8, 12, 20, 0.96)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px',
        padding: '0.7rem 0.85rem',
        boxShadow: '0 18px 36px rgba(0,0,0,0.32)'
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: '0.2rem' }}>{label}</p>
      {payload.map((entry) => (
        <p key={`${entry.dataKey}-${entry.name}`} style={{ color: entry.color || 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children, height = 280 }) {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
      <div>
        <h3>{title}</h3>
        <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{subtitle}</p>
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <p className="text-muted">No public activity to display yet.</p>
    </div>
  );
}

const priorityColors = {
  Critical: '#ff3b30',
  High: '#ff9500',
  Medium: '#00f0ff',
  Low: '#00ff88',
  Unknown: '#8a2be2'
};

const palette = ['#00f0ff', '#ff9500', '#00ff88', '#8a2be2', '#ff007f', '#7dd3fc'];

export default function PublicTransparency() {
  const [payload, setPayload] = useState({
    needs: [],
    volunteers: [],
    assignments: [],
    notifications: [],
    dispatchLogs: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      setError('');

      try {
        const [needsRes, volunteersRes, assignmentsRes, notificationsRes, dispatchRes] = await Promise.all([
          fetch('http://localhost:8000/api/needs?lang=en'),
          fetch('http://localhost:8000/api/volunteers'),
          fetch('http://localhost:8000/api/assignments'),
          fetch('http://localhost:8000/api/notifications'),
          fetch('http://localhost:8000/api/dispatch-logs')
        ]);

        const [needs, volunteers, assignments, notifications, dispatchLogs] = await Promise.all([
          needsRes.json(),
          volunteersRes.json(),
          assignmentsRes.json(),
          notificationsRes.json(),
          dispatchRes.json()
        ]);

        setPayload({
          needs: normalizeArray(needs),
          volunteers: normalizeArray(volunteers),
          assignments: normalizeArray(assignments),
          notifications: normalizeArray(notifications),
          dispatchLogs: normalizeArray(dispatchLogs)
        });
      } catch (fetchError) {
        console.error(fetchError);
        setError('The public transparency feed is temporarily unavailable.');
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, []);

  const stats = useMemo(() => {
    const activeNeeds = payload.needs.length;
    const criticalNeeds = payload.needs.filter((need) => need.urgency === 'Critical').length;
    const activeVolunteers = payload.volunteers.length;
    const assignmentsCompleted = payload.assignments.filter((assignment) => assignment.status === 'completed').length;
    const dispatchCount = payload.dispatchLogs.length;
    const unreadAlerts = payload.notifications.filter((notification) => !notification.read).length;
    const volunteerHours = payload.volunteers.reduce((sum, volunteer) => sum + (Number(volunteer.hoursVolunteered) || 0), 0);

    return {
      activeNeeds,
      criticalNeeds,
      activeVolunteers,
      assignmentsCompleted,
      dispatchCount,
      unreadAlerts,
      volunteerHours,
      needByCategory: countBy(payload.needs, (need) => need.category || 'Uncategorized'),
      needByUrgency: countBy(payload.needs, (need) => need.urgency || 'Unknown'),
      needByLocation: countBy(payload.needs, (need) => need.location || 'Unknown').slice(0, 6),
      assignmentFlow: countBy(payload.assignments, (assignment) => formatStatus(assignment.status)),
      publicPulse: [
        { label: 'Needs', value: activeNeeds },
        { label: 'Volunteers', value: activeVolunteers },
        { label: 'Dispatches', value: dispatchCount },
        { label: 'Alerts', value: unreadAlerts }
      ],
      publicPriorities: payload.needs
        .slice()
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
        .slice(0, 4),
      recentDispatches: payload.dispatchLogs
        .slice()
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
        .slice(0, 5)
    };
  }, [payload]);

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '2rem' }}>
      <section
        className="glass-panel"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(1.6rem, 4vw, 2.8rem)',
          background: 'linear-gradient(140deg, rgba(0,240,255,0.08), rgba(8,12,20,0.88) 42%, rgba(0,255,136,0.07))'
        }}
      >
        <div style={{ position: 'absolute', inset: '-10% auto auto -10%', width: '22rem', height: '22rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,240,255,0.16), transparent 64%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 'auto -8% -18% auto', width: '24rem', height: '24rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,255,136,0.12), transparent 64%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)', gap: '1.5rem', alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
              <ShieldCheck size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Public transparency page</span>
            </div>

            <div>
              <h1 className="text-gradient" style={{ fontSize: 'clamp(2.7rem, 6vw, 5.2rem)', lineHeight: 0.92, maxWidth: '12ch' }}>
                Open response visibility for the public.
              </h1>
              <p className="text-muted" style={{ marginTop: '0.75rem', maxWidth: '60ch', fontSize: '1rem' }}>
                This page translates live operational activity into a clean, presentation-ready public view. It highlights what is happening, how the response network is moving, and where community support is concentrated.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
              <Link to="/partners" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                Open Partner Portal
                <ArrowRight size={18} />
              </Link>
              <Link to="/dashboard" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                Open Mission Control
                <ArrowRight size={18} />
              </Link>
              <Link to="/" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                Return Home
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {[
              { label: 'Active needs', value: stats.activeNeeds, icon: <AlertTriangle size={18} />, accent: 'var(--accent-orange)' },
              { label: 'Volunteer hours', value: stats.volunteerHours, icon: <HeartHandshake size={18} />, accent: 'var(--accent-green)' },
              { label: 'Dispatch events', value: stats.dispatchCount, icon: <BellRing size={18} />, accent: 'var(--accent-cyan)' }
            ].map((item) => (
              <div key={item.label} className="glass-panel" style={{ padding: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)' }}>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
                  <h3 style={{ fontSize: '1.75rem', marginTop: '0.2rem' }}>{item.value}</h3>
                </div>
                <div style={{ width: '2.8rem', height: '2.8rem', borderRadius: '16px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)', color: item.accent }}>
                  {item.icon}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
          <LoaderCircle size={20} className="spinning" color="var(--accent-cyan)" />
          <span className="text-muted">Loading public transparency data...</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="glass-panel" style={{ padding: '1.4rem', borderColor: 'rgba(255,59,48,0.28)', background: 'rgba(255,59,48,0.05)' }}>
          <p style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{error}</p>
          <p className="text-muted" style={{ marginTop: '0.35rem' }}>
            The page remains available, but some live numbers may be missing until the service recovers.
          </p>
        </div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {[
          { label: 'Urgent cases', value: stats.criticalNeeds, detail: 'Needs currently marked critical for rapid response.', icon: <AlertTriangle size={22} />, accent: 'var(--accent-red)' },
          { label: 'Community volunteers', value: stats.activeVolunteers, detail: 'Registered people available to support response activity.', icon: <Users size={22} />, accent: 'var(--accent-cyan)' },
          { label: 'Completed assignments', value: stats.assignmentsCompleted, detail: 'Assignments fully completed and closed in the system.', icon: <CheckCircle2 size={22} />, accent: 'var(--accent-green)' },
          { label: 'Unread system alerts', value: stats.unreadAlerts, detail: 'Signals still awaiting operational review or action.', icon: <BellRing size={22} />, accent: 'var(--accent-orange)' }
        ].map((card) => (
          <div key={card.label} className="glass-panel" style={{ padding: '1.35rem', display: 'grid', gap: '0.85rem' }}>
            <div style={{ width: '3rem', height: '3rem', borderRadius: '18px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)', color: card.accent }}>
              {card.icon}
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.label}</p>
              <h2 style={{ fontSize: '2.1rem', marginTop: '0.25rem' }}>{card.value}</h2>
              <p style={{ marginTop: '0.38rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{card.detail}</p>
            </div>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <ChartCard
          title="Operational pulse"
          subtitle="A public snapshot of active needs, volunteers, dispatch activity, and live alerts."
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.publicPulse} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="transparencyPulse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="value" name="Count" stroke="#00f0ff" strokeWidth={3} fill="url(#transparencyPulse)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Need urgency mix"
          subtitle="How current public-facing needs are distributed by urgency level."
        >
          {stats.needByUrgency.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.needByUrgency} dataKey="value" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={3}>
                  {stats.needByUrgency.map((entry) => (
                    <Cell key={entry.label} fill={priorityColors[entry.label] || '#8a2be2'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: '1.25rem' }}>
        <ChartCard
          title="Support by category"
          subtitle="The type of needs the community is currently responding to most."
        >
          {stats.needByCategory.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.needByCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="value" name="Needs" radius={[10, 10, 0, 0]}>
                  {stats.needByCategory.map((entry, index) => (
                    <Cell key={entry.label} fill={palette[index % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard
          title="Assignment flow"
          subtitle="A simplified public view of how response assignments are moving."
        >
          {stats.assignmentFlow.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.assignmentFlow} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                <YAxis dataKey="label" type="category" width={92} stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="value" name="Assignments" radius={[0, 10, 10, 0]} fill="#00ff88" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 0.9fr)', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ padding: '1.6rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Current public priorities</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              A readable shortlist of the latest visible needs in the response ecosystem.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '0.8rem' }}>
            {stats.publicPriorities.length === 0 ? <p className="text-muted">No active public priorities to show right now.</p> : null}
            {stats.publicPriorities.map((need) => (
              <div
                key={need.id}
                style={{
                  padding: '1rem',
                  borderRadius: '16px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.03)',
                  display: 'grid',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{need.title}</p>
                    <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>{need.category} • {need.location}</p>
                  </div>
                  <span
                    style={{
                      padding: '0.3rem 0.7rem',
                      borderRadius: '999px',
                      background: `color-mix(in srgb, ${priorityColors[need.urgency] || '#8a2be2'} 18%, transparent)`,
                      color: priorityColors[need.urgency] || '#8a2be2',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      height: 'fit-content'
                    }}
                  >
                    {need.urgency}
                  </span>
                </div>
                <p className="text-muted" style={{ fontSize: '0.88rem' }}>{need.notes}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <ChartCard
            title="Geographic hotspots"
            subtitle="Locations currently showing the highest concentration of visible needs."
            height={240}
          >
            {stats.needByLocation.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.needByLocation} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="value" name="Needs" radius={[10, 10, 0, 0]} fill="#ff9500" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </ChartCard>

          <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '0.9rem' }}>
            <div>
              <h3>Recent dispatch timeline</h3>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Public-friendly snapshots of recent response actions.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {stats.recentDispatches.length === 0 ? <p className="text-muted">No dispatch events published yet.</p> : null}
              {stats.recentDispatches.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr)',
                    gap: '0.8rem',
                    alignItems: 'start',
                    padding: '0.9rem',
                    borderRadius: '14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--glass-border)'
                  }}
                >
                  <div style={{ width: '2.3rem', height: '2.3rem', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'rgba(0,240,255,0.08)' }}>
                    <MapPinned size={15} color="var(--accent-cyan)" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700 }}>{log.summary}</p>
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.16rem' }}>
                      {log.target || log.channel || 'system'} • {log.status || 'logged'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      
    </div>
  );
}
