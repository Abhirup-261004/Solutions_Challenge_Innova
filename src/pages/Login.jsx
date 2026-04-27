import { useState } from 'react';
import { useAuth, roleDefinitions } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, ShieldCheck } from 'lucide-react';

const roleOptions = Object.entries(roleDefinitions);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password, role);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to log in: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle(role, 'login');
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to sign in with Google: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell" style={{ maxWidth: '440px', margin: '4rem auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 className="text-gradient">Welcome Back</h2>
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>Access the command center with a role-specific demo view.</p>
      </div>

      <div className="glass-panel auth-card" style={{ padding: '2.5rem' }}>
        {error && <div style={{ padding: '12px', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--accent-red)', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                className="input-field"
                style={{ paddingLeft: '48px' }}
                placeholder="agent@network.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
                className="input-field"
                style={{ paddingLeft: '48px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Role View</label>
            <div style={{ position: 'relative' }}>
              <ShieldCheck size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
              <select className="input-field" style={{ paddingLeft: '48px', appearance: 'none' }} value={role} onChange={(e) => setRole(e.target.value)}>
                {roleOptions.map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>
              {roleDefinitions[role].description} If this account already has a saved role, the system will load that after sign-in.
            </p>
          </div>

          <button disabled={loading} type="submit" className="btn-primary" style={{ marginTop: '1rem', width: '100%', padding: '14px' }}>
            Sign In
          </button>
        </form>

        <div style={{ display: 'grid', gap: '0.9rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>or continue with</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="input-field"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)'
            }}
          >
            <span style={{
              width: '20px',
              height: '20px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              color: '#4285f4',
              fontSize: '0.85rem',
              fontWeight: 800
            }}>
              G
            </span>
            Sign in with Google
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
          <span className="text-muted">Need an account? </span>
          <Link to="/register" style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
