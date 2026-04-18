import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BellRing,
  BriefcaseMedical,
  Clock3,
  LoaderCircle,
  MapPinned,
  ShieldCheck,
  Users,
  Waves
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
import { useAuth } from '../contexts/AuthContext';

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function groupAndSort(items, accessor) {
  const groups = items.reduce((accumulator, item) => {
    const key = accessor(item);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(groups).sort(([, left], [, right]) => right - left);
}

function percent(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function formatStatus(status) {
  return String(status || 'pending')
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function buildInsight(metrics) {
  if (!metrics.totalNeeds) {
    return 'No live needs are in the system right now, so this page is ready to become your live executive briefing as soon as new operational data arrives.';
  }

  const parts = [];

  if (metrics.criticalNeeds > 0) {
    parts.push(`${metrics.criticalNeeds} critical need${metrics.criticalNeeds > 1 ? 's are' : ' is'} currently active`);
  } else {
    parts.push('there are no critical needs at the moment');
  }

  if (metrics.coverageRate < 60) {
    parts.push(`assignment coverage is still low at ${metrics.coverageRate}%`);
  } else {
    parts.push(`assignment coverage is holding at ${metrics.coverageRate}%`);
  }

  if (metrics.unreadNotifications > 0) {
    parts.push(`${metrics.unreadNotifications} unread notification${metrics.unreadNotifications > 1 ? 's are' : ' is'} waiting for review`);
  }

  return `Right now, ${parts.join(', ')}. This screen is designed to give admins and coordinators a fast executive snapshot before they move into Mission Control actions.`;
}

function MetricCard({ icon, label, value, detail, accent = 'var(--accent-cyan)' }) {
  return (
    <div className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '0.9rem', minHeight: '172px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
        <div
          style={{
            width: '3rem',
            height: '3rem',
            borderRadius: '18px',
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.05)',
            color: accent
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Live
        </span>
      </div>
      <div>
        <p className="text-muted" style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
        <h2 style={{ fontSize: '2.15rem', marginTop: '0.25rem' }}>{value}</h2>
        <p style={{ marginTop: '0.4rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{detail}</p>
      </div>
    </div>
  );
}

function ChartShell({ title, subtitle, children, height = 280 }) {
  return (
    <div className="glass-panel" style={{ padding: '1.6rem', display: 'grid', gap: '1.1rem' }}>
      <div>
        <h3>{title}</h3>
        <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{subtitle}</p>
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <p className="text-muted">No data to visualize yet.</p>
    </div>
  );
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
        <p key={entry.dataKey} style={{ color: entry.color || 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

const urgencyColors = {
  Critical: '#ff3b30',
  High: '#ff9500',
  Medium: '#00f0ff',
  Low: '#00ff88',
  Unknown: '#8a2be2'
};

const pieColors = ['#00f0ff', '#8a2be2', '#ff9500', '#00ff88', '#ff007f', '#7dd3fc'];

function buildDailyOpsSeries(metrics) {
  return [
    { label: 'Needs', value: metrics.totalNeeds },
    { label: 'Assigned', value: metrics.totalAssignments },
    { label: 'Alerts', value: metrics.unreadNotifications },
    { label: 'Reviews', value: metrics.pendingReviewCount }
  ];
}

export default function AnalyticsDashboard() {
  const { currentUser, getToken, hasPermission } = useAuth();
  const [payload, setPayload] = useState({
    needs: [],
    volunteers: [],
    assignments: [],
    notifications: [],
    dispatchLogs: [],
    reviewQueue: [],
    inventory: [],
    insights: {
      predictiveInsights: { categories: [], hotspots: [], headline: '' },
      inventoryPressure: [],
      sdgImpact: [],
      summary: {}
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError('');

      try {
        const baseRequests = [
          fetch('http://localhost:8000/api/needs?lang=en'),
          fetch('http://localhost:8000/api/volunteers'),
          fetch('http://localhost:8000/api/assignments'),
          fetch('http://localhost:8000/api/notifications'),
          fetch('http://localhost:8000/api/dispatch-logs'),
          fetch('http://localhost:8000/api/inventory')
        ];

        let reviewQueuePromise = Promise.resolve([]);
        if (hasPermission('intake_review')) {
          const token = await getToken();
          reviewQueuePromise = fetch('http://localhost:8000/api/review-queue', {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }).then(async (response) => {
            const data = await response.json();
            return response.ok ? normalizeArray(data) : [];
          });
        }

        const token = hasPermission('dashboard_view') ? await getToken() : null;
        const insightsPromise = token
          ? fetch('http://localhost:8000/api/insights/operations', {
            headers: { Authorization: `Bearer ${token}` }
          }).then((response) => response.json().then((data) => (response.ok ? data : null)))
          : Promise.resolve(null);

        const [needsRes, volunteersRes, assignmentsRes, notificationsRes, dispatchRes, inventoryRes, reviewQueue, insights] = await Promise.all([
          ...baseRequests,
          reviewQueuePromise,
          insightsPromise
        ]);

        const [needs, volunteers, assignments, notifications, dispatchLogs, inventory] = await Promise.all([
          needsRes.json(),
          volunteersRes.json(),
          assignmentsRes.json(),
          notificationsRes.json(),
          dispatchRes.json(),
          inventoryRes.json()
        ]);

        setPayload({
          needs: normalizeArray(needs),
          volunteers: normalizeArray(volunteers),
          assignments: normalizeArray(assignments),
          notifications: normalizeArray(notifications),
          dispatchLogs: normalizeArray(dispatchLogs),
          reviewQueue: normalizeArray(reviewQueue),
          inventory: normalizeArray(inventory),
          insights: insights || {
            predictiveInsights: { categories: [], hotspots: [], headline: '' },
            inventoryPressure: [],
            sdgImpact: [],
            summary: {}
          }
        });
      } catch (fetchError) {
        console.error(fetchError);
        setError('Analytics data could not be loaded right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [getToken, hasPermission]);

  const analytics = useMemo(() => {
    const needs = payload.needs;
    const volunteers = payload.volunteers;
    const assignments = payload.assignments;
    const notifications = payload.notifications;
    const dispatchLogs = payload.dispatchLogs;
    const reviewQueue = payload.reviewQueue;
    const inventory = payload.inventory;
    const insights = payload.insights;

    const totalNeeds = needs.length;
    const criticalNeeds = needs.filter((need) => need.urgency === 'Critical').length;
    const resolvedNeeds = needs.filter((need) => need.outcome?.status === 'resolved').length;
    const beneficiaryCount = needs.reduce((sum, need) => sum + (Number(need.outcome?.beneficiaryCount) || 0), 0);
    const volunteersNeeded = needs.reduce((sum, need) => sum + (Number(need.volunteersNeeded) || 0), 0);
    const totalAssignments = assignments.length;
    const openSpots = Math.max(volunteersNeeded - totalAssignments, 0);
    const coverageRate = percent(totalAssignments, volunteersNeeded || totalAssignments || 1);
    const unreadNotifications = notifications.filter((notification) => !notification.read).length;
    const activeVolunteers = volunteers.filter((volunteer) => (volunteer.hoursVolunteered || 0) > 0).length;
    const volunteerHours = volunteers.reduce((sum, volunteer) => sum + (Number(volunteer.hoursVolunteered) || 0), 0);
    const averageImpact = volunteers.length
      ? Math.round(volunteers.reduce((sum, volunteer) => sum + (Number(volunteer.impactScore) || 0), 0) / volunteers.length)
      : 0;

    return {
      totalNeeds,
      criticalNeeds,
      resolvedNeeds,
      beneficiaryCount,
      openSpots,
      totalAssignments,
      coverageRate,
      unreadNotifications,
      activeVolunteers,
      volunteerHours,
      averageImpact,
      lowInventoryCount: inventory.filter((item) => item.status === 'low').length,
      pendingReviewCount: reviewQueue.filter((item) => item.status === 'pending').length,
      categoryRows: groupAndSort(needs, (need) => need.category || 'Uncategorized').map(([label, value]) => ({ label, value })),
      urgencyRows: groupAndSort(needs, (need) => need.urgency || 'Unknown').map(([label, value]) => ({ label, value })),
      assignmentRows: groupAndSort(assignments, (assignment) => formatStatus(assignment.status)).map(([label, value]) => ({ label, value })),
      hotspotRows: groupAndSort(needs, (need) => need.location || 'Unknown').slice(0, 5).map(([label, value]) => ({ label, value })),
      notificationRows: groupAndSort(notifications, (notification) => notification.type || 'general').map(([label, value]) => ({
        label: formatStatus(label),
        value
      })),
      rankedVolunteers: volunteers
        .slice()
        .sort((left, right) => {
          const impactGap = (Number(right.impactScore) || 0) - (Number(left.impactScore) || 0);
          if (impactGap !== 0) {
            return impactGap;
          }

          return (Number(right.hoursVolunteered) || 0) - (Number(left.hoursVolunteered) || 0);
        }),
      dispatchFeed: dispatchLogs
        .slice()
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
        .slice(0, 6),
      predictiveHeadline: insights.predictiveInsights?.headline || 'Forecasts will appear as live operational patterns emerge.',
      forecastRows: normalizeArray(insights.predictiveInsights?.categories),
      sdgRows: normalizeArray(insights.sdgImpact)
    };
  }, [payload]);

  const insight = buildInsight(analytics);

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '2rem' }}>
      <section
        className="glass-panel"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(1.4rem, 4vw, 2.4rem)',
          background: 'linear-gradient(140deg, rgba(0,240,255,0.08), rgba(8,12,20,0.88) 46%, rgba(255,149,0,0.07))'
        }}
      >
        <div style={{ position: 'absolute', inset: '-10% auto auto -8%', width: '20rem', height: '20rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,240,255,0.16), transparent 62%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 'auto -8% -18% auto', width: '22rem', height: '22rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,149,0,0.14), transparent 64%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)', gap: '1.5rem', alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
              <BarChart3 size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Executive analytics layer</span>
            </div>

            <div>
              <h1 className="text-gradient" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.6rem)', lineHeight: 0.95 }}>
                Operational analytics dashboard
              </h1>
              <p className="text-muted" style={{ marginTop: '0.7rem', maxWidth: '62ch' }}>
                A dedicated command summary for leadership views. It turns live needs, volunteer movement, notifications, and dispatch activity into a quick decision layer.
              </p>
              {currentUser ? (
                <p style={{ marginTop: '0.55rem', fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                  Signed in as {currentUser.email} with {currentUser.role.replace('_', ' ')} access
                </p>
              ) : null}
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.1rem', background: 'rgba(255,255,255,0.03)' }}>
              <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-orange)' }}>What this means</p>
              <p style={{ marginTop: '0.45rem', color: 'var(--text-secondary)' }}>{insight}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {[
              { label: 'Open volunteer spots', value: analytics.openSpots, icon: <Users size={18} />, accent: 'var(--accent-green)' },
              { label: 'Unread alerts', value: analytics.unreadNotifications, icon: <BellRing size={18} />, accent: 'var(--accent-orange)' },
              { label: 'Pending approvals', value: analytics.pendingReviewCount, icon: <ShieldCheck size={18} />, accent: 'var(--accent-purple)' }
            ].map((item) => (
              <div key={item.label} className="glass-panel" style={{ padding: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.035)' }}>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
                  <h3 style={{ marginTop: '0.2rem', fontSize: '1.6rem' }}>{item.value}</h3>
                </div>
                <div style={{ width: '2.8rem', height: '2.8rem', borderRadius: '16px', display: 'grid', placeItems: 'center', color: item.accent, background: 'rgba(255,255,255,0.05)' }}>
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
          <span className="text-muted">Loading live analytics...</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="glass-panel" style={{ padding: '1.4rem', borderColor: 'rgba(255,59,48,0.28)', background: 'rgba(255,59,48,0.05)' }}>
          <p style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{error}</p>
          <p className="text-muted" style={{ marginTop: '0.35rem' }}>
            The page stays in place, but some widgets may be empty until the backend recovers.
          </p>
        </div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <MetricCard
          icon={<BriefcaseMedical size={22} />}
          label="Active Needs"
          value={analytics.totalNeeds}
          detail={`${analytics.criticalNeeds} critical priorities requiring immediate awareness.`}
          accent="var(--accent-pink)"
        />
        <MetricCard
          icon={<Users size={22} />}
          label="Assignment Coverage"
          value={`${analytics.coverageRate}%`}
          detail={`${analytics.totalAssignments} live assignments across all open need records.`}
          accent="var(--accent-cyan)"
        />
        <MetricCard
          icon={<Waves size={22} />}
          label="Volunteer Hours"
          value={`${analytics.volunteerHours}h`}
          detail={`${analytics.activeVolunteers} active volunteers are contributing tracked effort.`}
          accent="var(--accent-green)"
        />
        <MetricCard
          icon={<Clock3 size={22} />}
          label="Average Impact Score"
          value={analytics.averageImpact}
          detail="A quick blended signal from hours, missions, and volunteer contribution momentum."
          accent="var(--accent-purple)"
        />
        <MetricCard
          icon={<ShieldCheck size={22} />}
          label="Resolved Outcomes"
          value={analytics.resolvedNeeds}
          detail={`${analytics.beneficiaryCount} beneficiaries recorded across resolved interventions.`}
          accent="var(--accent-green)"
        />
        <MetricCard
          icon={<AlertTriangle size={22} />}
          label="Low Inventory Alerts"
          value={analytics.lowInventoryCount}
          detail="Supplies at or below threshold now feed into operational pressure decisions."
          accent="var(--accent-orange)"
        />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ padding: '1.6rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Predictive Insight</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              This layer helps tell a proactive story instead of a reactive one.
            </p>
          </div>
          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
            <p style={{ fontWeight: 700 }}>{analytics.predictiveHeadline}</p>
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {analytics.forecastRows.slice(0, 4).map((row) => (
              <div key={row.category} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ fontWeight: 700 }}>{row.category}</p>
                <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>{row.rationale}</p>
              </div>
            ))}
          </div>
        </div>

        <ChartShell
          title="SDG-aligned impact"
          subtitle="How live and resolved work maps to challenge-relevant SDG outcomes."
          height={320}
        >
          {analytics.sdgRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.sdgRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="id" stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="needs" name="Needs" fill="#00f0ff" radius={[10, 10, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#00ff88" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChartState />}
        </ChartShell>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <ChartShell
          title="Needs by category"
          subtitle="Which operational domains are driving the current workload."
        >
          {analytics.categoryRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.categoryRows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="value" name="Needs" radius={[10, 10, 0, 0]} fill="#00f0ff" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChartState />}
        </ChartShell>
        <ChartShell
          title="Urgency mix"
          subtitle="A fast view of how much of the queue is critical, high, or moderate."
        >
          {analytics.urgencyRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.urgencyRows}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={3}
                >
                  {analytics.urgencyRows.map((entry) => (
                    <Cell key={entry.label} fill={urgencyColors[entry.label] || '#8a2be2'} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChartState />}
        </ChartShell>
        <ChartShell
          title="Assignment pipeline"
          subtitle="Where assignments currently sit in the response lifecycle."
        >
          {analytics.assignmentRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.assignmentRows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="assignmentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ff88" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#00ff88" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="value" name="Assignments" stroke="#00ff88" strokeWidth={3} fill="url(#assignmentFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChartState />}
        </ChartShell>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(300px, 0.9fr)', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ padding: '1.7rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h3>Top volunteer performers</h3>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Ranked from the live roster by impact score.
              </p>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 700 }}>
              <ArrowUpRight size={16} />
              Leaderboard-ready view
            </span>
          </div>

          <div style={{ display: 'grid', gap: '0.8rem' }}>
            {analytics.rankedVolunteers.length === 0 ? <p className="text-muted">No volunteer data available yet.</p> : null}
            {analytics.rankedVolunteers.map((volunteer, index) => (
              <div
                key={volunteer.id || volunteer._id || `${volunteer.name || 'volunteer'}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                  gap: '0.85rem',
                  alignItems: 'center',
                  padding: '0.95rem 1rem',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--glass-border)'
                }}
              >
                <div style={{ width: '2.4rem', height: '2.4rem', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'rgba(0,240,255,0.08)', color: 'var(--accent-cyan)', fontWeight: 800 }}>
                  {index + 1}
                </div>
                <div>
                  <p style={{ fontWeight: 700 }}>{volunteer.name}</p>
                  <p className="text-muted" style={{ fontSize: '0.84rem' }}>
                    {volunteer.skill} • {volunteer.location} • {volunteer.badge || 'Response volunteer'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 700 }}>{volunteer.impactScore || 0}</p>
                  <p className="text-muted" style={{ fontSize: '0.78rem' }}>{volunteer.hoursVolunteered || 0} hrs</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <ChartShell
            title="Notification mix"
            subtitle="The alert types currently flowing through the in-app center."
            height={250}
          >
            {analytics.notificationRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.notificationRows} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                  <YAxis dataKey="label" type="category" stroke="#a0a0b0" tickLine={false} axisLine={false} width={92} fontSize={12} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="value" name="Alerts" radius={[0, 10, 10, 0]} fill="#ff007f" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChartState />}
          </ChartShell>
          <ChartShell
            title="Geographic hotspots"
            subtitle="Locations with the highest concentration of active need records."
            height={250}
          >
            {analytics.hotspotRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.hotspotRows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="value" name="Needs" radius={[10, 10, 0, 0]}>
                    {analytics.hotspotRows.map((entry, index) => (
                      <Cell key={entry.label} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChartState />}
          </ChartShell>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: '1.25rem' }}>
        <ChartShell
          title="Operations pulse"
          subtitle="A compact visual comparing the main live workload signals on one graph."
          height={290}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={buildDailyOpsSeries(analytics)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="opsPulse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="value" name="Count" stroke="#00f0ff" strokeWidth={3} fill="url(#opsPulse)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="Volunteer share"
          subtitle="How the top contributors compare by impact score."
          height={290}
        >
          {analytics.rankedVolunteers.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.rankedVolunteers.map((volunteer, index) => ({
                    id: volunteer.id || volunteer._id || `volunteer-share-${index}`,
                    label: volunteer.name || `Volunteer ${index + 1}`,
                    value: volunteer.impactScore || 0
                  }))}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {analytics.rankedVolunteers.map((volunteer, index) => (
                    <Cell key={volunteer.id || volunteer._id || `volunteer-share-cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChartState />}
        </ChartShell>
      </section>

      <section className="glass-panel" style={{ padding: '1.7rem', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3>Recent dispatch activity</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              A simplified executive feed of the latest outreach and operational system events.
            </p>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-cyan)', fontSize: '0.84rem', fontWeight: 700 }}>
            <MapPinned size={16} />
            Latest 6 events
          </span>
        </div>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {analytics.dispatchFeed.length === 0 ? <p className="text-muted">Dispatch telemetry will appear here once events start flowing.</p> : null}
          {analytics.dispatchFeed.map((log) => (
            <div
              key={log.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                gap: '0.9rem',
                alignItems: 'center',
                padding: '0.95rem 1rem',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid var(--glass-border)'
              }}
            >
              <div style={{ width: '2.35rem', height: '2.35rem', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'rgba(255,149,0,0.12)', color: 'var(--accent-orange)' }}>
                <AlertTriangle size={15} />
              </div>
              <div>
                <p style={{ fontWeight: 600 }}>{log.summary}</p>
                <p className="text-muted" style={{ fontSize: '0.82rem' }}>{log.target || log.channel || 'system'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--accent-green)' }}>{log.status || 'logged'}</p>
                <p className="text-muted" style={{ fontSize: '0.74rem', marginTop: '0.18rem' }}>
                  {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
