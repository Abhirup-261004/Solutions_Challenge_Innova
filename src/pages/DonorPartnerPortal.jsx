import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  Building2,
  CircleDollarSign,
  HeartHandshake,
  LoaderCircle,
  Package,
  ShieldCheck,
  Users
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

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function groupCounts(items, accessor) {
  return Object.entries(
    items.reduce((accumulator, item) => {
      const key = accessor(item);
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {})
  )
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

function MetricCard({ title, value, detail, icon, accent }) {
  return (
    <div className="glass-panel" style={{ padding: '1.3rem', display: 'grid', gap: '0.85rem', minHeight: '168px' }}>
      <div style={{ width: '2.9rem', height: '2.9rem', borderRadius: '18px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)', color: accent }}>
        {icon}
      </div>
      <div>
        <p className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</p>
        <h2 style={{ fontSize: '2rem', marginTop: '0.3rem' }}>{value}</h2>
        <p style={{ marginTop: '0.35rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{detail}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, height = 300 }) {
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

function EmptyState({ label = 'No data to display yet.' }) {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <p className="text-muted">{label}</p>
    </div>
  );
}

const palette = ['#00f0ff', '#00ff88', '#ff9500', '#8a2be2', '#ff007f', '#7dd3fc'];

export default function DonorPartnerPortal() {
  const [payload, setPayload] = useState({
    needs: [],
    volunteers: [],
    inventory: [],
    dispatchLogs: [],
    notifications: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPortal = async () => {
      setLoading(true);
      setError('');

      try {
        const [needsRes, volunteersRes, inventoryRes, dispatchRes, notificationsRes] = await Promise.all([
          fetch('http://localhost:8000/api/needs?lang=en'),
          fetch('http://localhost:8000/api/volunteers'),
          fetch('http://localhost:8000/api/inventory'),
          fetch('http://localhost:8000/api/dispatch-logs'),
          fetch('http://localhost:8000/api/notifications')
        ]);

        const [needs, volunteers, inventory, dispatchLogs, notifications] = await Promise.all([
          needsRes.json(),
          volunteersRes.json(),
          inventoryRes.json(),
          dispatchRes.json(),
          notificationsRes.json()
        ]);

        setPayload({
          needs: normalizeArray(needs),
          volunteers: normalizeArray(volunteers),
          inventory: normalizeArray(inventory),
          dispatchLogs: normalizeArray(dispatchLogs),
          notifications: normalizeArray(notifications)
        });
      } catch (fetchError) {
        console.error(fetchError);
        setError('The donor and partner portal is temporarily unavailable.');
      } finally {
        setLoading(false);
      }
    };

    loadPortal();
  }, []);

  const portal = useMemo(() => {
    const activeNeeds = payload.needs;
    const volunteers = payload.volunteers;
    const inventory = payload.inventory;
    const dispatchLogs = payload.dispatchLogs;
    const notifications = payload.notifications;

    const lowInventory = inventory.filter((item) => item.status === 'low');
    const resolvedNeeds = activeNeeds.filter((need) => ['resolved', 'closed'].includes(need.outcome?.status));
    const beneficiaryCount = activeNeeds.reduce((sum, need) => sum + (Number(need.outcome?.beneficiaryCount) || 0), 0);
    const trainedVolunteers = volunteers.filter((volunteer) => (volunteer.certifications || []).length > 0).length;
    const urgentNeeds = activeNeeds
      .filter((need) => ['Critical', 'High'].includes(need.urgency))
      .sort((left, right) => String(left.urgency).localeCompare(String(right.urgency)))
      .slice(0, 4);

    const categoryDemand = groupCounts(activeNeeds, (need) => need.category || 'Uncategorized');
    const opportunityMix = [
      { label: 'Fund urgent cases', value: urgentNeeds.length },
      { label: 'Restock inventory', value: lowInventory.length },
      { label: 'Support training', value: trainedVolunteers ? Math.max(1, Math.round(trainedVolunteers / 2)) : 1 }
    ];

    const partnershipLanes = [
      {
        title: 'Rapid Relief Sponsor',
        amount: '$2,500',
        body: 'Fund high-priority needs, emergency transport, and fast-response field support.',
        coverage: `${urgentNeeds.length || 1} urgent need lanes currently waiting for support.`
      },
      {
        title: 'Inventory Backstop Partner',
        amount: '$1,200',
        body: 'Replenish the supply lines that are already at or below threshold across operational hubs.',
        coverage: `${lowInventory.length || 1} supply categories currently need replenishment.`
      },
      {
        title: 'Volunteer Training Partner',
        amount: '$900',
        body: 'Sponsor certification access, readiness expansion, and safe deployment of trained volunteers.',
        coverage: `${volunteers.length - trainedVolunteers > 0 ? volunteers.length - trainedVolunteers : 1} volunteers can still be moved into trusted-response readiness.`
      }
    ];

    return {
      activeNeeds: activeNeeds.length,
      urgentNeeds: urgentNeeds.length,
      beneficiaryCount,
      trainedVolunteers,
      lowInventoryCount: lowInventory.length,
      dispatchCount: dispatchLogs.length,
      unreadAlerts: notifications.filter((notification) => !notification.read).length,
      categoryDemand,
      opportunityMix,
      partnershipLanes,
      urgentNeedsList: urgentNeeds,
      lowInventoryList: lowInventory.slice(0, 4),
      recentDispatches: dispatchLogs
        .slice()
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
        .slice(0, 5),
      impactStories: [
        {
          label: 'Needs resolved',
          value: resolvedNeeds.length,
          detail: 'Completed or closed interventions now visible to donors and implementation partners.'
        },
        {
          label: 'Beneficiaries reached',
          value: beneficiaryCount,
          detail: 'Outcome tracking turns operations into measurable, presentation-ready social impact.'
        },
        {
          label: 'Certified responders',
          value: trainedVolunteers,
          detail: 'Partners can see that volunteer deployment is backed by training and trust signals.'
        }
      ]
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
          background: 'linear-gradient(140deg, rgba(255,149,0,0.08), rgba(8,12,20,0.88) 40%, rgba(0,240,255,0.07))'
        }}
      >
        <div style={{ position: 'absolute', inset: '-10% auto auto -8%', width: '22rem', height: '22rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,149,0,0.18), transparent 64%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 'auto -10% -20% auto', width: '24rem', height: '24rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,240,255,0.15), transparent 66%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, 0.8fr)', gap: '1.5rem', alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
              <HeartHandshake size={16} color="var(--accent-orange)" />
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Donor and partner ecosystem portal</span>
            </div>

            <div>
              <h1 className="text-gradient" style={{ fontSize: 'clamp(2.6rem, 6vw, 5rem)', lineHeight: 0.92, maxWidth: '12ch' }}>
                A public home for partners, funders, and support networks.
              </h1>
              <p className="text-muted" style={{ marginTop: '0.75rem', maxWidth: '62ch', fontSize: '1rem' }}>
                This portal turns live operations into a collaboration surface. Donors can see where support matters most, while partner organizations can identify supply, staffing, and training gaps they can help close.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
              <Link to="/transparency" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                Open Transparency View
                <ArrowRight size={18} />
              </Link>
              <Link to="/dashboard" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                Open Mission Control
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            
            {[
              { label: 'Urgent support lanes', value: portal.urgentNeeds, icon: <AlertTriangle size={18} />, accent: 'var(--accent-orange)' },
              { label: 'Low-stock categories', value: portal.lowInventoryCount, icon: <Package size={18} />, accent: 'var(--accent-cyan)' },
              { label: 'Certified responders', value: portal.trainedVolunteers, icon: <ShieldCheck size={18} />, accent: 'var(--accent-green)' }
            ].map((item) => (
              <div key={item.label} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)' }}>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
                  <h3 style={{ fontSize: '1.7rem', marginTop: '0.2rem' }}>{item.value}</h3>
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
          <span className="text-muted">Loading donor and partner intelligence...</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="glass-panel" style={{ padding: '1.4rem', borderColor: 'rgba(255,59,48,0.28)', background: 'rgba(255,59,48,0.05)' }}>
          <p style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{error}</p>
          <p className="text-muted" style={{ marginTop: '0.35rem' }}>
            The portal shell remains available, but live opportunity widgets may be empty until the backend recovers.
          </p>
        </div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <MetricCard
          title="Active needs"
          value={portal.activeNeeds}
          detail="Live requests currently visible across the response network."
          icon={<Users size={20} />}
          accent="var(--accent-cyan)"
        />
        <MetricCard
          title="Beneficiaries reached"
          value={portal.beneficiaryCount}
          detail="Recorded through outcome tracking rather than estimated storytelling."
          icon={<HeartHandshake size={20} />}
          accent="var(--accent-green)"
        />
        <MetricCard
          title="Dispatch events"
          value={portal.dispatchCount}
          detail="Signals that the operational engine is active, not static."
          icon={<BellRing size={20} />}
          accent="var(--accent-purple)"
        />
        <MetricCard
          title="Unread alerts"
          value={portal.unreadAlerts}
          detail="A simple way for partners to see current operational pressure."
          icon={<AlertTriangle size={20} />}
          accent="var(--accent-orange)"
        />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: '1.25rem' }}>
        <ChartCard
          title="Support demand by category"
          subtitle="Where the ecosystem can add the most value right now."
          height={320}
        >
          {portal.categoryDemand.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={portal.categoryDemand} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" stroke="#a0a0b0" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke="#a0a0b0" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="value" name="Needs" radius={[10, 10, 0, 0]}>
                  {portal.categoryDemand.map((entry, index) => (
                    <Cell key={entry.label} fill={palette[index % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState label="Support demand will appear here as needs are created." />}
        </ChartCard>

        <ChartCard
          title="Partner contribution mix"
          subtitle="A simple framing for where money, supplies, and enablement can go."
          height={320}
        >
          {portal.opportunityMix.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portal.opportunityMix}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={52}
                  paddingAngle={3}
                >
                  {portal.opportunityMix.map((entry, index) => (
                    <Cell key={entry.label} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </ChartCard>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {portal.partnershipLanes.map((lane) => (
          <div key={lane.title} className="glass-panel" style={{ padding: '1.4rem', display: 'grid', gap: '0.8rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,149,0,0.04))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>{lane.title}</p>
                <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>{lane.body}</p>
              </div>
              <div style={{ minWidth: 'fit-content', padding: '0.45rem 0.75rem', borderRadius: '999px', background: 'rgba(0,240,255,0.08)', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>
                {lane.amount}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>{lane.coverage}</p>
            </div>
            <button type="button" className="btn-secondary" style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Express Partnership Interest
              <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Priority opportunities</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              These are the clearest areas where funders and implementation partners can make an immediate difference.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {portal.urgentNeedsList.map((need) => (
              <div key={need.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', borderColor: need.urgency === 'Critical' ? 'rgba(255,149,0,0.28)' : 'var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{need.translatedTitle || need.title}</p>
                    <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.18rem' }}>
                      {need.location} • {need.category} • {need.openSpots || 0} open volunteer spots
                    </p>
                  </div>
                  <div style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', background: need.urgency === 'Critical' ? 'rgba(255,59,48,0.12)' : 'rgba(255,149,0,0.12)', color: need.urgency === 'Critical' ? 'var(--accent-red)' : 'var(--accent-orange)', fontSize: '0.78rem', fontWeight: 700 }}>
                    {need.urgency}
                  </div>
                </div>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.55rem' }}>{need.notes}</p>
              </div>
            ))}
            {!portal.urgentNeedsList.length ? <EmptyState label="No urgent partnership opportunities are live right now." /> : null}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '0.9rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,240,255,0.03))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Building2 size={18} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0 }}>Why organizations care</h3>
            </div>
            {[
              'See where funding converts into operational movement, not just static donation requests.',
              'Understand whether the response engine has supply gaps, staffing gaps, or training gaps.',
              'Show partners that assignments are tied to trust signals like certification and badge readiness.',
              'Offer a public-facing ecosystem layer that makes the platform feel deployment-ready during demos.'
            ].map((point) => (
              <div key={point} className="glass-panel" style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                <p>{point}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Package size={18} color="var(--accent-orange)" />
              <h3 style={{ margin: 0 }}>Low-stock inventory watch</h3>
            </div>
            {portal.lowInventoryList.map((item) => (
              <div key={item.id} className="glass-panel" style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,149,0,0.24)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{item.name}</p>
                    <p className="text-muted" style={{ fontSize: '0.82rem' }}>{item.location} • {item.category}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700 }}>{item.quantity} {item.unit}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--accent-orange)' }}>Threshold {item.threshold}</p>
                  </div>
                </div>
              </div>
            ))}
            {!portal.lowInventoryList.length ? <EmptyState label="Inventory is currently healthy across visible hubs." /> : null}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {portal.impactStories.map((story) => (
          <div key={story.label} className="glass-panel" style={{ padding: '1.3rem', display: 'grid', gap: '0.55rem', background: 'rgba(255,255,255,0.025)' }}>
            <p className="text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{story.label}</p>
            <h2 style={{ fontSize: '2rem' }}>{story.value}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{story.detail}</p>
          </div>
        ))}
      </section>

      <section className="glass-panel" style={{ padding: '1.6rem', display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3>Recent operational activity</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
              A visible trail of recent system movement builds confidence for funders and partner organizations.
            </p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>
            <BarChart3 size={16} />
            Live ecosystem signal
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          {portal.recentDispatches.map((log) => (
            <div key={log.id} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{log.summary}</p>
                  <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.18rem' }}>{log.target || log.channel || 'system'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--accent-green)' }}>{log.status || 'logged'}</p>
                  <p className="text-muted" style={{ fontSize: '0.74rem', marginTop: '0.18rem' }}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Pending'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {!portal.recentDispatches.length ? <EmptyState label="Recent public-facing activity will appear here as dispatch events are logged." /> : null}
        </div>
      </section>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
