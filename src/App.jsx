import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Activity, BarChart3, ClipboardCheck, CreditCard, Eye, FileClock, Globe2, GraduationCap, Handshake, Home, LogIn, LogOut, Map as MapIcon, Menu, MessageSquareWarning, ShieldCheck, Users, X } from 'lucide-react';
import { AuthProvider, roleDefinitions, useAuth } from './contexts/AuthContext';

import ApprovalQueue from './pages/ApprovalQueue';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import AppErrorBoundary from './components/AppErrorBoundary';
import AuditTrail from './pages/AuditTrail';
import BillingCenter from './pages/BillingCenter';
import CommunityReportingPortal from './pages/CommunityReportingPortal';
import OperationsChatbot from './components/OperationsChatbot';
import Dashboard from './pages/Dashboard';
import DataIntake from './pages/DataIntake';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import MultiOrganizationCenter from './pages/MultiOrganizationCenter';
import DonorPartnerPortal from './pages/DonorPartnerPortal';
import IncidentCommandCenter from './pages/IncidentCommandCenter';
import PublicTransparency from './pages/PublicTransparency';
import Register from './pages/Register';
import TrainingCenter from './pages/TrainingCenter';
import VolunteerPortal from './pages/VolunteerPortal';

function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <AccessDenied allowedRoles={allowedRoles} />;
  }
  return children;
}

function AccessDenied({ allowedRoles }) {
  return (
    <div className="glass-panel" style={{ maxWidth: '720px', margin: '4rem auto', padding: '2.5rem', textAlign: 'center' }}>
      <div style={{ width: '4rem', height: '4rem', borderRadius: '999px', display: 'grid', placeItems: 'center', margin: '0 auto 1rem', background: 'rgba(255,59,48,0.12)' }}>
        <Eye size={24} color="var(--accent-red)" />
      </div>
      <h2 className="text-gradient">Access Restricted</h2>
      <p className="text-muted" style={{ marginTop: '0.75rem' }}>
        This area is available only to: {allowedRoles.map((role) => roleDefinitions[role]?.label || role).join(', ')}.
      </p>
      <div style={{ marginTop: '1.5rem' }}>
        <Link to="/dashboard" className="btn-secondary">Return to Mission Control</Link>
      </div>
    </div>
  );
}

function Navigation() {
  const location = useLocation();
  const { currentUser, hasPermission, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: <Home size={20} />, visible: true },
    { path: '/community-report', label: 'Report Need', icon: <MessageSquareWarning size={20} />, visible: true },
    { path: '/transparency', label: 'Transparency', icon: <Globe2 size={20} />, visible: true },
    { path: '/partners', label: 'Partners', icon: <Handshake size={20} />, visible: true },
    { path: '/dashboard', label: 'Mission Control', icon: <Activity size={20} />, visible: Boolean(currentUser) },
    { path: '/incident-command', label: 'Incident Command', icon: <ShieldCheck size={20} />, visible: Boolean(currentUser) },
    { path: '/network', label: 'Network Ops', icon: <Handshake size={20} />, visible: Boolean(currentUser) },
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={20} />, visible: Boolean(currentUser) },
    { path: '/billing', label: 'Billing', icon: <CreditCard size={20} />, visible: Boolean(currentUser) },
    { path: '/audit-trail', label: 'Audit Trail', icon: <FileClock size={20} />, visible: Boolean(currentUser) },
    { path: '/approval-queue', label: 'Approval Queue', icon: <ClipboardCheck size={20} />, visible: hasPermission('intake_review') },
    { path: '/intake', label: 'Data Intake', icon: <MapIcon size={20} />, visible: hasPermission('intake_access') },
    { path: '/training', label: 'Training', icon: <GraduationCap size={20} />, visible: hasPermission('training_access') },
    { path: '/volunteer', label: 'Volunteer Portal', icon: <Users size={20} />, visible: hasPermission('volunteer_register') }
  ].filter((item) => item.visible);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="navbar glass-panel">
      <div className="navbar-brand">
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.7rem', color: 'inherit' }}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(0,240,255,0.22), rgba(138,43,226,0.22))', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,0.12)' }}>
            <Home size={16} color="var(--accent-cyan)" />
          </div>
          <span className="text-gradient font-display" style={{ fontSize: '1.5rem', fontWeight: 800 }}>ResourceSync</span>
        </Link>
        <button
          type="button"
          className="navbar-toggle btn-secondary"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((current) => !current)}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div className={`navbar-links ${mobileMenuOpen ? 'is-open' : ''}`}>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className={`navbar-actions ${mobileMenuOpen ? 'is-open' : ''}`}>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'grid', gap: '0.2rem', textAlign: 'right' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{currentUser.email}</span>
              <span style={{ display: 'inline-flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                <ShieldCheck size={13} />
                {roleDefinitions[currentUser.role]?.label || 'Viewer'}
              </span>
            </div>
            <button onClick={logout} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/login" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <LogIn size={16} /> Sign In
            </Link>
            <Link to="/register" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppErrorBoundary>
        <Router>
          <div className="app-container">
            <header className="app-header">
              <Navigation />
            </header>

            <main className="main-content animate-fade-in">
              <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/community-report" element={<CommunityReportingPortal />} />
              <Route path="/transparency" element={<PublicTransparency />} />
              <Route path="/partners" element={<DonorPartnerPortal />} />
              <Route
                path="/incident-command"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator', 'viewer']}>
                    <IncidentCommandCenter />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/network"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator', 'viewer']}>
                    <MultiOrganizationCenter />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/dashboard"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator', 'field_volunteer', 'viewer']}>
                    <Dashboard />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/billing"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator', 'field_volunteer', 'viewer']}>
                    <BillingCenter />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/audit-trail"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator', 'field_volunteer', 'viewer']}>
                    <AuditTrail />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/analytics"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator', 'field_volunteer', 'viewer']}>
                    <AnalyticsDashboard />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/approval-queue"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator']}>
                    <ApprovalQueue />
                  </ProtectedRoute>
                )}
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route
                path="/intake"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator']}>
                    <DataIntake />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/training"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator', 'field_volunteer']}>
                    <TrainingCenter />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/volunteer"
                element={(
                  <ProtectedRoute allowedRoles={['admin', 'coordinator', 'field_volunteer']}>
                    <VolunteerPortal />
                  </ProtectedRoute>
                )}
              />
              </Routes>
            </main>

            <OperationsChatbot />
          </div>
        </Router>
      </AppErrorBoundary>
    </AuthProvider>
  );
}

export default App;
