import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  BellRing,
  ClipboardCheck,
  CreditCard,
  FileScan,
  Globe2,
  GraduationCap,
  HeartHandshake,
  MapPinned,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Waves
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { roleDefinitions, useAuth } from '../contexts/AuthContext';

const platformHighlights = [
  {
    title: 'Responsible AI Intake',
    body: 'OCR and machine-generated drafts are reviewed before publication, so automation stays useful without bypassing human judgment.',
    icon: FileScan,
    accent: 'var(--accent-cyan)'
  },
  {
    title: 'Escalation Workflow',
    body: 'High-risk needs are automatically escalated when they remain understaffed, giving the system a real operational chain of accountability.',
    icon: AlertTriangle,
    accent: 'var(--accent-orange)'
  },
  {
    title: 'Certified Volunteers',
    body: 'Training, badges, certificates, and certification-aware matching make volunteer assignment more trustworthy and more defensible.',
    icon: GraduationCap,
    accent: 'var(--accent-green)'
  }
];

const systemFlow = [
  {
    id: '01',
    title: 'Capture',
    body: 'Needs enter from manual intake, OCR scans, and machine-generated drafts.'
  },
  {
    id: '02',
    title: 'Approve',
    body: 'Coordinators review OCR and SMS submissions before they go live.'
  },
  {
    id: '03',
    title: 'Escalate',
    body: 'Urgent understaffed needs trigger notifications and escalation workflow.'
  },
  {
    id: '04',
    title: 'Deploy',
    body: 'Certified volunteers are matched, assigned, and tracked through completion.'
  }
];

const trustSignals = [
  {
    title: 'Certification-Gated Matching',
    body: 'Tasks can require badges such as First Aid Ready or Food Safety Steward before assignment.',
    icon: ShieldCheck,
    accent: 'var(--accent-green)'
  },
  {
    title: 'Audit Trail Visibility',
    body: 'Important actions are logged so judges, admins, and coordinators can explain what happened and why.',
    icon: ClipboardCheck,
    accent: 'var(--accent-purple)'
  },
  {
    title: 'Public Transparency Layer',
    body: 'A public-facing page communicates impact and live activity without exposing internal controls.',
    icon: Globe2,
    accent: 'var(--accent-cyan)'
  }
];

const passportPillars = [
  {
    title: 'Qualified',
    body: 'Sensitive work can be badge-gated so only trained volunteers are eligible for assignment.',
    icon: GraduationCap,
    accent: 'var(--accent-green)'
  },
  {
    title: 'Verified',
    body: 'Completed missions can be coordinator-verified after reviewing field evidence and final delivery.',
    icon: ShieldCheck,
    accent: 'var(--accent-cyan)'
  },
  {
    title: 'Auditable',
    body: 'Every critical action leaves an explainable record across audit logs, notifications, and dispatch history.',
    icon: ClipboardCheck,
    accent: 'var(--accent-orange)'
  }
];

const roleCards = [
  { role: 'admin', route: '/dashboard', accent: 'var(--accent-cyan)', summary: 'Executive oversight, approvals, escalations, and platform control.' },
  { role: 'coordinator', route: '/approval-queue', accent: 'var(--accent-purple)', summary: 'Approve drafts, assign certified volunteers, and keep response throughput moving.' },
  { role: 'field_volunteer', route: '/training', accent: 'var(--accent-green)', summary: 'Earn badges, activate your profile, and join live response work with visible trust signals.' },
  { role: 'viewer', route: '/transparency', accent: 'var(--accent-pink)', summary: 'See a clean read-only story of the platform during demos, judging, or stakeholder walkthroughs.' }
];

const capabilityRoutes = [
  {
    title: 'Mission Control',
    description: 'Urgent needs, crisis map, escalation queue, notifications, and live assignment controls.',
    route: '/dashboard',
    icon: Activity,
    accent: 'var(--accent-cyan)',
    gate: ({ currentUser }) => Boolean(currentUser)
  },
  {
    title: 'Incident Command',
    description: 'Executive incident briefing with live escalations, resource pressure, mutual aid, and operational timeline in one room.',
    route: '/incident-command',
    icon: ShieldCheck,
    accent: 'var(--accent-orange)',
    gate: ({ currentUser }) => Boolean(currentUser)
  },
  {
    title: 'Network Operations',
    description: 'Dedicated multi-organization execution board for mutual aid approvals, transit, delivery, verification, and closure.',
    route: '/network',
    icon: Users,
    accent: 'var(--accent-cyan)',
    gate: ({ currentUser }) => Boolean(currentUser)
  },
  {
    title: 'Training Center',
    description: 'Certification courses, downloadable PDF certificates, renewal reminders, and trained-volunteer leaderboard.',
    route: '/training',
    icon: GraduationCap,
    accent: 'var(--accent-green)',
    gate: ({ hasPermission }) => hasPermission('training_access')
  },
  {
    title: 'Analytics',
    description: 'Presentation-ready charts and operational metrics for leadership and judging.',
    route: '/analytics',
    icon: BarChart3,
    accent: 'var(--accent-orange)',
    gate: ({ currentUser }) => Boolean(currentUser)
  },
  {
    title: 'Billing Center',
    description: 'Subscription management, pricing activation, and payment history for turning the platform into a real SaaS product.',
    route: '/billing',
    icon: CreditCard,
    accent: 'var(--accent-cyan)',
    gate: ({ currentUser }) => Boolean(currentUser)
  },
  {
    title: 'Approval Queue',
    description: 'Human review for machine-generated drafts before operational publication.',
    route: '/approval-queue',
    icon: ClipboardCheck,
    accent: 'var(--accent-purple)',
    gate: ({ hasPermission }) => hasPermission('intake_review')
  },
  {
    title: 'Volunteer Portal',
    description: 'Register volunteers, surface badge readiness, and connect field participation with trust credentials.',
    route: '/volunteer',
    icon: Users,
    accent: 'var(--accent-green)',
    gate: ({ hasPermission }) => hasPermission('volunteer_register')
  },
  {
    title: 'Community Reporting',
    description: 'A public intake channel where residents can report needs that coordinators review before publication.',
    route: '/community-report',
    icon: AlertTriangle,
    accent: 'var(--accent-pink)',
    gate: () => true
  },
  {
    title: 'Public Transparency',
    description: 'Open a polished public-facing surface for impact, trust, and storytelling.',
    route: '/transparency',
    icon: Shield,
    accent: 'var(--accent-cyan)',
    gate: () => true
  },
  {
    title: 'Donor + Partner Portal',
    description: 'A polished ecosystem-facing page for funders, NGOs, and implementation partners to see where they can help.',
    route: '/partners',
    icon: HeartHandshake,
    accent: 'var(--accent-orange)',
    gate: () => true
  }
];

const pricingTiers = [
  {
    name: 'Community',
    price: 'Free',
    audience: 'Best for local groups, student teams, and pilot deployments.',
    accent: 'var(--accent-green)',
    highlight: 'Core response operations stay accessible',
    features: [
      'Need intake, approval queue, and volunteer registration',
      'Basic assignments, notifications, and transparency page',
      'Offline field mode for essential mission continuity',
      'Training basics, certifications, and core analytics'
    ]
  },
  {
    name: 'Pro Coordination',
    price: '$49/mo',
    audience: 'Best for growing NGOs, district teams, and recurring response programs.',
    accent: 'var(--accent-cyan)',
    highlight: 'Adds scale, coordination depth, and reporting',
    featured: true,
    features: [
      'Advanced analytics and predictive insights',
      'Expanded audit trail, exports, and coordinator controls',
      'Partner-facing workflows and richer operations visibility',
      'Priority onboarding and support for active teams'
    ]
  },
  {
    name: 'Enterprise Response',
    price: 'Custom',
    audience: 'Best for governments, city programs, donor coalitions, and large nonprofits.',
    accent: 'var(--accent-orange)',
    highlight: 'Governance, integrations, and multi-stakeholder scale',
    features: [
      'Multi-organization management and custom governance',
      'API access, branded portals, and institutional reporting',
      'Advanced partner, donor, and compliance workflows',
      'Dedicated onboarding, support, and long-term deployment planning'
    ]
  }
];

function getVisibleRoutes(currentUser, hasPermission) {
  return capabilityRoutes.filter((item) => item.gate({ currentUser, hasPermission }));
}

function getPrimaryRoutes(routes) {
  const priority = [
    'Mission Control',
    'Network Operations',
    'Training Center',
    'Analytics',
    'Community Reporting',
    'Public Transparency'
  ];

  return routes
    .slice()
    .sort((left, right) => priority.indexOf(left.title) - priority.indexOf(right.title))
    .slice(0, 6);
}

export default function LandingPage() {
  const { currentUser, hasPermission } = useAuth();
  const visibleRoutes = getVisibleRoutes(currentUser, hasPermission);
  const primaryRoutes = getPrimaryRoutes(visibleRoutes);

  return (
    <div style={{ display: 'grid', gap: '2.75rem' }}>
      <section
        className="glass-panel"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(1.8rem, 4vw, 3.2rem)',
          background: 'linear-gradient(140deg, rgba(0,240,255,0.08), rgba(8,12,20,0.88) 42%, rgba(255,149,0,0.08))'
        }}
      >
        <div style={{ position: 'absolute', inset: '-10% auto auto -8%', width: '24rem', height: '24rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,240,255,0.2), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 'auto -10% -24% auto', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,149,0,0.18), transparent 68%)', pointerEvents: 'none' }} />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '2rem',
            alignItems: 'stretch'
          }}
        >
          <div style={{ display: 'grid', gap: '1.3rem', alignContent: 'start' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)' }}>
              <Sparkles size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Crisis coordination platform with responsible AI and trust-based volunteer readiness</span>
            </div>

            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <h1 style={{ fontSize: 'clamp(3rem, 6vw, 5.8rem)', lineHeight: 0.92, maxWidth: '11ch' }}>
                Make response work feel credible, coordinated, and fast.
              </h1>
              <p style={{ fontSize: '1.06rem', maxWidth: '60ch', color: 'var(--text-secondary)' }}>
                ResourceSync turns field intake into reviewed operational tasks, escalates unattended urgent needs, and matches certified volunteers through a role-based mission control system built for real-world trust and demo impact.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to={currentUser ? '/dashboard' : '/login'} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                {currentUser ? 'Enter Mission Control' : 'Open the Platform'}
                <ArrowRight size={18} />
              </Link>
              <Link to={currentUser ? '/training' : '/register'} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                {currentUser ? 'Open Training Center' : 'Create an Account'}
                <ArrowRight size={18} />
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.9rem', marginTop: '0.6rem' }}>
              {[
                { label: 'AI + Human Review', value: 'OCR drafts moderated' },
                { label: 'Operational Trust', value: 'Badge-aware assignments' },
                { label: 'Leadership Visibility', value: 'Analytics + transparency' }
              ].map((stat) => (
                <div key={stat.label} className="glass-panel" style={{ padding: '1rem 1.1rem', background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</p>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.3rem' }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1rem', alignContent: 'start' }}>
            <div className="glass-panel" style={{ padding: '1.35rem', background: 'rgba(10,16,28,0.74)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ width: '2.9rem', height: '2.9rem', borderRadius: '18px', display: 'grid', placeItems: 'center', background: 'rgba(0,240,255,0.12)' }}>
                    <Waves size={20} color="var(--accent-cyan)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Operational Snapshot</p>
                    <h3 style={{ fontSize: '1.25rem' }}>Coordinated flood response</h3>
                  </div>
                </div>
                <div style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', border: '1px solid rgba(255,149,0,0.18)', background: 'rgba(255,149,0,0.08)', color: 'var(--accent-orange)', fontSize: '0.78rem', fontWeight: 700 }}>
                  Escalations + training active
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.8rem' }}>
                {[
                  { icon: FileScan, title: 'OCR intake enters review', body: 'Scanned field reports become machine-generated drafts instead of immediate live records.' },
                  { icon: BellRing, title: 'Urgent need escalates', body: 'Critical requests that remain understaffed are surfaced for coordinator action.' },
                  { icon: Award, title: 'Certified volunteer assigned', body: 'Matching prefers badge-holding responders for sensitive work categories.' }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem', padding: '0.9rem', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
                      <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                        <Icon size={16} color="var(--accent-cyan)" />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700 }}>{item.title}</p>
                        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.18rem' }}>{item.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
              <div className="glass-panel" style={{ padding: '1.25rem', background: 'linear-gradient(180deg, rgba(0,255,136,0.08), rgba(255,255,255,0.02))' }}>
                <p style={{ color: 'var(--accent-green)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Volunteer Trust</p>
                <h2 style={{ fontSize: '2.1rem', marginTop: '0.2rem' }}>Badges</h2>
                <p className="text-muted" style={{ fontSize: '0.88rem' }}>Courses, certificates, renewal reminders, and certification-aware dispatch.</p>
              </div>
              <div className="glass-panel" style={{ padding: '1.25rem', background: 'linear-gradient(180deg, rgba(138,43,226,0.1), rgba(255,255,255,0.02))' }}>
                <p style={{ color: 'var(--accent-purple)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Decision Layer</p>
                <h2 style={{ fontSize: '2.1rem', marginTop: '0.2rem' }}>Escalation</h2>
                <p className="text-muted" style={{ fontSize: '0.88rem' }}>The platform now behaves like an operating system, not just a form dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: '1.15rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Why It Stands Out</p>
            <h2 style={{ marginTop: '0.45rem' }}>Built around trust, not just task management.</h2>
          </div>
          <p className="text-muted" style={{ maxWidth: '48ch' }}>
            The strongest parts of the product are now grouped into one clearer section so visitors understand the core value without scanning half the page first.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {[...platformHighlights, ...passportPillars].slice(0, 6).map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '0.9rem', background: 'rgba(255,255,255,0.035)' }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '18px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                  <Icon size={21} color={item.accent} />
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p className="text-muted" style={{ marginTop: '0.45rem', fontSize: '0.94rem' }}>{item.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <p style={{ color: 'var(--accent-orange)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Workflow</p>
          <h2 style={{ marginTop: '0.45rem' }}>How the system moves from report to trustworthy response</h2>

          <div style={{ display: 'grid', gap: '1rem', marginTop: '1.35rem' }}>
            {systemFlow.map((step) => (
              <div key={step.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.9rem', alignItems: 'start' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'rgba(255,149,0,0.12)', color: 'var(--accent-orange)', fontWeight: 800 }}>
                  {step.id}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem' }}>{step.title}</h3>
                  <p className="text-muted" style={{ marginTop: '0.25rem', fontSize: '0.92rem' }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', background: 'linear-gradient(180deg, rgba(0,240,255,0.06), rgba(255,255,255,0.02))' }}>
          <p style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Trust Layer</p>
          <h3 style={{ marginTop: '0.45rem' }}>Why the platform feels more enterprise-ready now</h3>

          <div style={{ display: 'grid', gap: '0.9rem', marginTop: '1.2rem' }}>
            {trustSignals.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.04)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.85rem' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '15px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                    <Icon size={17} color={item.accent} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700 }}>{item.title}</p>
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: 'var(--accent-green)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Core Routes</p>
            <h2 style={{ marginTop: '0.45rem' }}>Start with the most important pages.</h2>
          </div>
          <p className="text-muted" style={{ maxWidth: '48ch' }}>
            Instead of showing every route at equal weight, the landing page now highlights the core demo journey first.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {(primaryRoutes.length ? primaryRoutes : [
            {
              title: 'Sign In to Explore',
              description: 'Use role-based access to open the full operations experience.',
              route: '/login',
              icon: ShieldCheck,
              accent: 'var(--accent-cyan)'
            }
          ]).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                to={item.route}
                className="landing-card"
                style={{
                  padding: '1.2rem',
                  display: 'grid',
                  gap: '0.8rem',
                  borderRadius: '20px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.04)'
                }}
              >
                <div style={{ width: '3rem', height: '3rem', borderRadius: '18px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                  <Icon size={19} color={item.accent} />
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p className="text-muted" style={{ marginTop: '0.3rem', fontSize: '0.88rem' }}>{item.description}</p>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: item.accent, fontWeight: 700 }}>
                  Open Module
                  <ArrowRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <p style={{ color: 'var(--accent-green)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Role-Based Experience</p>
          <h2 style={{ marginTop: '0.45rem' }}>Different users see different value.</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {roleCards.map((item) => (
            <Link
              key={item.role}
              to={item.route}
              className="landing-card"
              style={{
                padding: '1.4rem',
                display: 'grid',
                gap: '0.8rem',
                borderRadius: '22px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              <div style={{ width: '3rem', height: '3rem', borderRadius: '18px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                <ShieldCheck size={20} color={item.accent} />
              </div>
              <div>
                <h3>{roleDefinitions[item.role]?.label || item.role}</h3>
                <p className="text-muted" style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
                  {item.summary}
                </p>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: item.accent, fontWeight: 700 }}>
                Explore Route
                <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="glass-panel"
        style={{
          padding: 'clamp(1.5rem, 3vw, 2.4rem)',
          display: 'grid',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(0,255,136,0.07), rgba(7,10,18,0.96) 42%, rgba(0,198,255,0.08))'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '64ch' }}>
            <p style={{ color: 'var(--accent-green)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Sustainability Model</p>
            <h2 style={{ marginTop: '0.45rem' }}>Built to stay accessible, then scale responsibly.</h2>
            <p className="text-muted" style={{ marginTop: '0.55rem', fontSize: '0.96rem' }}>
              Core humanitarian coordination remains available in the free tier, while paid plans are framed around governance, reporting, integrations, and multi-stakeholder scale. The goal is not to put relief behind a paywall, but to make the platform sustainable for long-term deployment.
            </p>
          </div>
          <div className="glass-panel" style={{ padding: '1rem 1.1rem', minWidth: '240px', background: 'rgba(255,255,255,0.03)' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pricing principle</p>
            <p style={{ fontSize: '1.04rem', fontWeight: 700, marginTop: '0.35rem' }}>
              Free for core response. Paid for scale and governance.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className="glass-panel"
              style={{
                padding: '1.35rem',
                display: 'grid',
                gap: '0.95rem',
                background: tier.featured
                  ? 'linear-gradient(180deg, rgba(0,198,255,0.1), rgba(255,255,255,0.025))'
                  : 'rgba(255,255,255,0.025)',
                border: tier.featured ? '1px solid rgba(0,198,255,0.22)' : '1px solid var(--glass-border)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {tier.featured ? (
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.3rem 0.7rem', borderRadius: '999px', background: 'rgba(0,198,255,0.14)', color: 'var(--accent-cyan)', fontSize: '0.74rem', fontWeight: 700 }}>
                  Recommended
                </div>
              ) : null}

              <div>
                <p style={{ fontSize: '0.78rem', color: tier.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tier.name}</p>
                <h3 style={{ fontSize: '2rem', marginTop: '0.35rem' }}>{tier.price}</h3>
                <p className="text-muted" style={{ fontSize: '0.86rem', marginTop: '0.35rem' }}>{tier.audience}</p>
              </div>

              <div className="glass-panel" style={{ padding: '0.85rem 0.95rem', background: 'rgba(255,255,255,0.03)' }}>
                <p style={{ fontWeight: 700, fontSize: '0.86rem', color: tier.accent }}>{tier.highlight}</p>
              </div>

              <div style={{ display: 'grid', gap: '0.65rem' }}>
                {tier.features.slice(0, 3).map((feature) => (
                  <div key={feature} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.7rem', alignItems: 'start' }}>
                    <div style={{ width: '1.6rem', height: '1.6rem', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                      <ShieldCheck size={13} color={tier.accent} />
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.84rem' }}>{feature}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        className="glass-panel"
        style={{
          padding: '2.2rem',
          background: 'linear-gradient(135deg, rgba(138,43,226,0.12), rgba(0,240,255,0.07) 55%, rgba(255,149,0,0.08))',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          alignItems: 'center'
        }}
      >
        <div>
          <p style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Ready To Explore</p>
          <h2 style={{ marginTop: '0.45rem' }}>Open the product through a stronger story than before.</h2>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <Link to={currentUser ? '/billing' : '/login'} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
            {currentUser ? 'Open Billing Center' : 'Sign In'}
            <ArrowRight size={17} />
          </Link>
          <Link to={currentUser ? '/training' : '/register'} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
            {currentUser ? 'Open Training Center' : 'Register'}
            <Trophy size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
