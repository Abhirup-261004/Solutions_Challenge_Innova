import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileHeart, Globe2, MapPin, Send, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const initialFormState = {
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  title: '',
  location: '',
  category: 'Medical',
  urgency: 'Medium',
  volunteersNeeded: 1,
  notes: ''
};

export default function CommunityReportingPortal() {
  const [formValues, setFormValues] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Community reports are reviewed by coordinators before they go live.');

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: name === 'volunteersNeeded' ? Number(value) || 1 : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('http://localhost:8000/api/community-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formValues,
          source: 'community'
        })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to submit community report');
      }

      setSubmitted(true);
      setStatusMessage('Your report has been received and placed into the coordinator approval queue.');
      setFormValues(initialFormState);
    } catch (error) {
      console.error(error);
      setStatusMessage(`Submission failed. ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '2rem' }}>
      <section
        className="glass-panel"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(1.6rem, 4vw, 2.8rem)',
          background: 'linear-gradient(140deg, rgba(0,255,136,0.08), rgba(8,12,20,0.9) 42%, rgba(0,240,255,0.08))'
        }}
      >
        <div style={{ position: 'absolute', inset: '-10% auto auto -8%', width: '22rem', height: '22rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,255,136,0.16), transparent 64%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 'auto -8% -18% auto', width: '24rem', height: '24rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,240,255,0.14), transparent 64%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)', gap: '1.5rem', alignItems: 'stretch' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
              <Globe2 size={16} color="var(--accent-green)" />
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Community reporting portal</span>
            </div>

            <div>
              <h1 className="text-gradient" style={{ fontSize: 'clamp(2.7rem, 6vw, 5rem)', lineHeight: 0.92, maxWidth: '12ch' }}>
                Let the public report needs safely.
              </h1>
              <p className="text-muted" style={{ marginTop: '0.75rem', maxWidth: '60ch', fontSize: '1rem' }}>
                Community members can now submit local issues directly into ResourceSync. Every report goes to the approval queue first, so real-world reporting is welcomed without bypassing coordinator review.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
              <Link to="/transparency" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                Public Transparency
              </Link>
              <Link to="/" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                Return Home
              </Link>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {[
              {
                title: 'Public-first intake',
                body: 'Anyone can submit a need without requiring internal system access.',
                icon: <Users size={18} color="var(--accent-cyan)" />
              },
              {
                title: 'Coordinator review',
                body: 'Reports never go live instantly; they enter the approval queue for verification.',
                icon: <ShieldCheck size={18} color="var(--accent-green)" />
              },
              {
                title: 'Operational realism',
                body: 'This demonstrates how the system receives signals from the real world, not only internal staff.',
                icon: <AlertTriangle size={18} color="var(--accent-orange)" />
              }
            ].map((item) => (
              <div key={item.title} className="glass-panel" style={{ padding: '1rem 1.1rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.8rem', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ width: '2.4rem', height: '2.4rem', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                  {item.icon}
                </div>
                <div>
                  <p style={{ fontWeight: 700 }}>{item.title}</p>
                  <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.18rem' }}>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(300px, 0.9fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          {submitted ? (
            <div className="animate-fade-in" style={{ minHeight: '420px', display: 'grid', placeItems: 'center', textAlign: 'center', gap: '1rem' }}>
              <div>
                <CheckCircle2 size={64} color="var(--accent-green)" style={{ margin: '0 auto 1rem' }} />
                <h2>Report submitted</h2>
                <p className="text-muted" style={{ marginTop: '0.5rem', maxWidth: '48ch' }}>
                  A coordinator will review this community report before it appears in the live operations feed.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setSubmitted(false);
                    setStatusMessage('Community reports are reviewed by coordinators before they go live.');
                  }}
                  style={{ marginTop: '1.25rem' }}
                >
                  Submit Another Report
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.2rem' }}>
              <div>
                <h2>Report a community need</h2>
                <p className="text-muted" style={{ marginTop: '0.4rem' }}>{statusMessage}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <Field label="Your Name">
                  <input name="contactName" required className="input-field" value={formValues.contactName} onChange={handleFieldChange} placeholder="Full name" />
                </Field>
                <Field label="Email">
                  <input name="contactEmail" required type="email" className="input-field" value={formValues.contactEmail} onChange={handleFieldChange} placeholder="name@example.com" />
                </Field>
              </div>

              <Field label="Phone Number">
                <input name="contactPhone" className="input-field" value={formValues.contactPhone} onChange={handleFieldChange} placeholder="Optional contact number" />
              </Field>

              <Field label="Need Title">
                <input name="title" required className="input-field" value={formValues.title} onChange={handleFieldChange} placeholder="Short summary of what is needed" />
              </Field>

              <Field label="Location">
                <input name="location" required className="input-field" value={formValues.location} onChange={handleFieldChange} placeholder="Neighborhood, address, or landmark" />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <Field label="Category">
                  <select name="category" className="input-field" value={formValues.category} onChange={handleFieldChange} style={{ appearance: 'none' }}>
                    <option value="Medical">Medical</option>
                    <option value="Food">Food</option>
                    <option value="Education">Education</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Labor">Labor</option>
                  </select>
                </Field>
                <Field label="Urgency">
                  <select name="urgency" className="input-field" value={formValues.urgency} onChange={handleFieldChange} style={{ appearance: 'none' }}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </Field>
              </div>

              <Field label="Estimated Volunteers Needed">
                <input name="volunteersNeeded" type="number" min="1" className="input-field" value={formValues.volunteersNeeded} onChange={handleFieldChange} />
              </Field>

              <Field label="Detailed Description">
                <textarea
                  name="notes"
                  required
                  rows="5"
                  className="input-field"
                  value={formValues.notes}
                  onChange={handleFieldChange}
                  placeholder="Explain the situation, who is affected, and what kind of help is needed."
                />
              </Field>

              <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', padding: '16px' }}>
                <Send size={18} />
                {submitting ? 'Submitting...' : 'Submit Community Report'}
              </button>
            </form>
          )}
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,240,255,0.04))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.9rem' }}>
              <FileHeart size={18} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0 }}>How this works</h3>
            </div>
            {[
              'Residents and community workers submit local needs here.',
              'Every report enters the approval queue for coordinator review.',
              'Only reviewed and approved reports become live operational needs.',
              'This keeps the platform open to the public while still maintaining data quality and safety.'
            ].map((point) => (
              <div key={point} className="glass-panel" style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.025)', marginTop: '0.75rem' }}>
                <p>{point}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  );
}
