import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const emptyReason = 'Rejected during coordinator review';

export default function ApprovalQueue() {
  const { getToken, hasPermission } = useAuth();
  const canReview = hasPermission('intake_review');
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [formState, setFormState] = useState({});
  const [statusMessage, setStatusMessage] = useState('Loading approval queue...');

  const fetchQueue = async () => {
    if (!canReview) return;
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('http://localhost:8000/api/review-queue', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      const safeItems = Array.isArray(data) ? data : [];
      setQueueItems(safeItems);
      setFormState((current) => buildFormState(safeItems, current));
      setStatusMessage(safeItems.length ? 'Review machine-generated drafts before they go live.' : 'No pending OCR or SMS drafts right now.');
    } catch (error) {
      console.error(error);
      setQueueItems([]);
      setStatusMessage(`Failed to load approval queue. ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleFieldChange = (id, field, value) => {
    setFormState((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: field === 'volunteersNeeded' ? Number(value) || '' : value
      }
    }));
  };

  const approveItem = async (id) => {
    setSavingId(id);
    try {
      const token = await getToken();
      const response = await fetch(`http://localhost:8000/api/review-queue/${encodeURIComponent(id)}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formState[id])
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Approval failed');
      }
      setStatusMessage(`Approved: ${data.need.title} is now live in Mission Control.`);
      await fetchQueue();
    } catch (error) {
      console.error(error);
      setStatusMessage(`Approval failed. ${error.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const rejectItem = async (id) => {
    setSavingId(id);
    try {
      const token = await getToken();
      const response = await fetch(`http://localhost:8000/api/review-queue/${encodeURIComponent(id)}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: emptyReason })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Rejection failed');
      }
      setStatusMessage(`Rejected: ${data.reviewItem.fields.title || 'draft'} was removed from the live pipeline.`);
      await fetchQueue();
    } catch (error) {
      console.error(error);
      setStatusMessage(`Rejection failed. ${error.message}`);
    } finally {
      setSavingId(null);
    }
  };

  if (!canReview) {
    return (
      <div className="glass-panel" style={{ maxWidth: '760px', margin: '3rem auto', padding: '2.5rem', textAlign: 'center' }}>
        <ShieldAlert size={40} color="var(--accent-orange)" style={{ marginBottom: '1rem' }} />
        <h2 className="text-gradient">Approval Queue Restricted</h2>
        <p className="text-muted" style={{ marginTop: '0.75rem' }}>
          Only admins and coordinators can review OCR and SMS-generated drafts before they go live.
        </p>
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '2rem' }}>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="text-gradient">Approval Queue</h1>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>Review OCR and SMS-generated drafts before they enter the live operations feed.</p>
          <p style={{ marginTop: '0.45rem', fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{statusMessage}</p>
        </div>
        <button type="button" className="btn-primary" onClick={fetchQueue} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          Refresh Queue
        </button>
      </section>

      <section style={{ display: 'grid', gap: '1.25rem' }}>
        {queueItems.length === 0 && !loading ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <ClipboardCheck size={34} color="var(--accent-green)" style={{ marginBottom: '1rem' }} />
            <h3>No Pending Drafts</h3>
            <p className="text-muted" style={{ marginTop: '0.4rem' }}>Machine-generated OCR and SMS drafts will appear here for approval.</p>
          </div>
        ) : null}

        {queueItems.map((item) => (
          <div key={item.id} className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <ClipboardCheck size={18} color="var(--accent-purple)" />
                  {item.fields.title || 'Untitled draft'}
                </h3>
                <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
                  Source: {item.source.toUpperCase()} • Submitted {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <span style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>
                Pending Review
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <Field label="Title">
                <input className="input-field" value={formState[item.id]?.title || ''} onChange={(e) => handleFieldChange(item.id, 'title', e.target.value)} />
              </Field>
              <Field label="Location">
                <input className="input-field" value={formState[item.id]?.location || ''} onChange={(e) => handleFieldChange(item.id, 'location', e.target.value)} />
              </Field>
              <Field label="Category">
                <select className="input-field" value={formState[item.id]?.category || 'Medical'} onChange={(e) => handleFieldChange(item.id, 'category', e.target.value)}>
                  <option value="Medical">Medical</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Education">Education</option>
                  <option value="Labor">Labor</option>
                  <option value="Food">Food</option>
                </select>
              </Field>
              <Field label="Urgency">
                <select className="input-field" value={formState[item.id]?.urgency || 'Medium'} onChange={(e) => handleFieldChange(item.id, 'urgency', e.target.value)}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </Field>
              <Field label="Volunteers Needed">
                <input className="input-field" type="number" min="1" value={formState[item.id]?.volunteersNeeded || 1} onChange={(e) => handleFieldChange(item.id, 'volunteersNeeded', e.target.value)} />
              </Field>
            </div>

            <Field label="Notes">
              <textarea className="input-field" rows="4" value={formState[item.id]?.notes || ''} onChange={(e) => handleFieldChange(item.id, 'notes', e.target.value)} />
            </Field>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button type="button" className="btn-secondary" onClick={() => rejectItem(item.id)} disabled={savingId === item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <XCircle size={16} />
                {savingId === item.id ? 'Saving...' : 'Reject'}
              </button>
              <button type="button" className="btn-primary" onClick={() => approveItem(item.id)} disabled={savingId === item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <CheckCircle2 size={16} />
                {savingId === item.id ? 'Saving...' : 'Approve & Publish'}
              </button>
            </div>
          </div>
        ))}
      </section>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
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

function buildFormState(items, current) {
  const next = { ...current };
  items.forEach((item) => {
    if (!next[item.id]) {
      next[item.id] = { ...item.fields };
    }
  });
  return next;
}
