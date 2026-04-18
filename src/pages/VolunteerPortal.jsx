import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle,
  Clock3,
  Flame,
  GraduationCap,
  Heart,
  MapPin,
  PencilLine,
  Radio,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  UserPlus,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { deleteJson, getJson, patchJson, postJson, putJson } from '../utils/api';
import {
  applyOfflineFieldOp,
  fileToDataUrl,
  formatAssignmentStatus,
  queueOfflineFieldOp,
  readOfflineFieldOpsQueue,
  writeOfflineFieldOpsQueue
} from '../utils/offlineFieldOps';

const initialFormState = {
  name: '',
  skill: '',
  location: '',
  radius: 5
};

const trendLabels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
const fieldStatusOptions = ['pending', 'accepted', 'en_route', 'completed'];

export default function VolunteerPortal() {
  const [submitted, setSubmitted] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formValues, setFormValues] = useState(initialFormState);
  const [fieldAssignments, setFieldAssignments] = useState([]);
  const [fieldAssignmentsLoading, setFieldAssignmentsLoading] = useState(true);
  const [fieldSyncMessage, setFieldSyncMessage] = useState('');
  const [fieldEvidenceDrafts, setFieldEvidenceDrafts] = useState({});
  const [fieldStatusUpdatingId, setFieldStatusUpdatingId] = useState(null);
  const [fieldEvidenceUploadingId, setFieldEvidenceUploadingId] = useState(null);
  const [syncingFieldOps, setSyncingFieldOps] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [offlineOpsCount, setOfflineOpsCount] = useState(readOfflineFieldOpsQueue().length);
  const [trainingSummary, setTrainingSummary] = useState({
    badges: [],
    completedCourses: [],
    certificates: []
  });
  const { currentUser, getToken, hasPermission } = useAuth();
  const canRegisterVolunteers = hasPermission('volunteer_register');

  useEffect(() => {
    const loadPortalState = async () => {
      if (!currentUser) {
        setLoadingProfile(false);
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          setLoadingProfile(false);
          return;
        }

        const [trainingData, profileData] = await Promise.all([
          getJson('/api/training/courses', { token }),
          getJson('/api/volunteers/me', { token })
        ]);

        if (trainingData.success) {
          setTrainingSummary(dataOrFallback(trainingData.training));
        }

        if (profileData.success) {
          const volunteer = profileData.volunteer || null;
          setProfile(volunteer);
          setFormValues(volunteer
            ? {
              name: volunteer.name || '',
              skill: volunteer.skill || '',
              location: volunteer.location || '',
              radius: Number(volunteer.radius) || 5
            }
            : initialFormState
          );
        }
      } catch (error) {
        console.error('Failed to load volunteer portal data:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadPortalState();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!profile?.id) {
      setFieldAssignments([]);
      setFieldAssignmentsLoading(false);
      return;
    }

    loadFieldAssignments(profile);
  }, [profile?.id]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (profile?.id) {
        syncOfflineFieldOps(profile);
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine && profile?.id && readOfflineFieldOpsQueue().length) {
      syncOfflineFieldOps(profile);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [profile?.id]);

  const activityTrend = useMemo(() => buildActivityTrend(profile), [profile]);
  const chartPath = useMemo(() => buildSparklinePath(activityTrend), [activityTrend]);
  const readinessCards = useMemo(() => buildReadinessCards(profile, trainingSummary), [profile, trainingSummary]);
  const passportChecks = useMemo(() => buildPassportChecks(profile, trainingSummary), [profile, trainingSummary]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: name === 'radius' ? Number(value) || 5 : value
    }));
  };

  const handleCreateProfile = async (event) => {
    event.preventDefault();
    if (!canRegisterVolunteers) return;

    setSavingProfile(true);
    try {
      const token = await getToken();
      const data = await postJson('/api/volunteers', formValues, { token });

      setProfile(data);
      setFormValues({
        name: data.name || '',
        skill: data.skill || '',
        location: data.location || '',
        radius: Number(data.radius) || 5
      });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Failed to register volunteer');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    if (!profile) return;

    setSavingProfile(true);
    try {
      const token = await getToken();
      const data = await putJson('/api/volunteers/me', formValues, { token });

      setProfile(data.volunteer);
      setFormValues({
        name: data.volunteer.name || '',
        skill: data.volunteer.skill || '',
        location: data.volunteer.location || '',
        radius: Number(data.volunteer.radius) || 5
      });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2500);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Failed to update volunteer profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!profile) return;

    const confirmed = window.confirm('Delete this volunteer profile? This will remove your roster entry and bring back the registration form.');
    if (!confirmed) {
      return;
    }

    setDeletingProfile(true);
    try {
      const token = await getToken();
      await deleteJson('/api/volunteers/me', { token });

      setProfile(null);
      setFormValues(initialFormState);
      setSubmitted(false);
      setFieldAssignments([]);
      setFieldEvidenceDrafts({});
    } catch (error) {
      console.error(error);
      alert(error.message || 'Failed to delete volunteer profile');
    } finally {
      setDeletingProfile(false);
    }
  };

  const loadFieldAssignments = async (activeProfile = profile) => {
    if (!activeProfile?.id) {
      setFieldAssignments([]);
      setFieldAssignmentsLoading(false);
      return;
    }

    setFieldAssignmentsLoading(true);
    try {
      const needs = await getJson('/api/needs?lang=en');
      const normalizedAssignments = normalizeVolunteerAssignments(Array.isArray(needs) ? needs : [], activeProfile.id);
      setFieldAssignments(normalizedAssignments);
    } catch (error) {
      console.error('Failed to load volunteer assignments:', error);
      setFieldSyncMessage('Unable to load field assignments right now.');
    } finally {
      setFieldAssignmentsLoading(false);
    }
  };

  const syncOfflineFieldOps = async (activeProfile = profile) => {
    const queue = readOfflineFieldOpsQueue();
    if (!queue.length) {
      setOfflineOpsCount(0);
      return;
    }

    setSyncingFieldOps(true);
    try {
      const token = await getToken();
      if (!token) {
        return;
      }

      const remaining = [];

      for (const operation of queue) {
        try {
          await postOrPatchOperation(operation, token);
        } catch {
          remaining.push(operation);
        }
      }

      writeOfflineFieldOpsQueue(remaining);
      setOfflineOpsCount(remaining.length);

      if (!remaining.length) {
        setFieldSyncMessage('Offline field actions synced successfully once connectivity returned.');
        window.dispatchEvent(new Event('resourcesync:data-changed'));
        await loadFieldAssignments(activeProfile);
      } else {
        setFieldSyncMessage(`${remaining.length} field action${remaining.length === 1 ? '' : 's'} are still waiting to sync.`);
      }
    } catch (error) {
      console.error('Offline field sync failed:', error);
    } finally {
      setSyncingFieldOps(false);
    }
  };

  const handleFieldAssignmentStatusChange = async (assignment, nextStatus) => {
    const operation = {
      type: 'status',
      assignmentId: assignment.assignmentId,
      endpoint: `http://localhost:8000/api/assignments/${encodeURIComponent(assignment.assignmentId)}/status`,
      method: 'PATCH',
      payload: { status: nextStatus }
    };

    const queueStatusChange = (message) => {
      queueOfflineFieldOp(operation);
      setOfflineOpsCount(readOfflineFieldOpsQueue().length);
      setFieldAssignments((current) => applyOfflineFieldOp(current, operation));
      setFieldSyncMessage(message);
    };

    if (isOffline) {
      queueStatusChange(`Offline mode is active. ${assignment.needTitle} was queued as ${formatAssignmentStatus(nextStatus)} and will sync automatically.`);
      return;
    }

    setFieldStatusUpdatingId(assignment.assignmentId);
    try {
      const token = await getToken();
      await patchJson(operation.endpoint, operation.payload, { token });

      setFieldSyncMessage(`${assignment.needTitle} is now ${formatAssignmentStatus(nextStatus)}.`);
      await loadFieldAssignments();
      window.dispatchEvent(new Event('resourcesync:data-changed'));
    } catch (error) {
      console.error(error);
      queueStatusChange(`Network issue detected. ${assignment.needTitle} was queued locally and will sync later. ${error.message}`);
    } finally {
      setFieldStatusUpdatingId(null);
    }
  };

  const handleFieldEvidenceDraftChange = async (assignmentId, file) => {
    if (!file) {
      setFieldEvidenceDrafts((current) => ({
        ...current,
        [assignmentId]: {
          fileName: '',
          mimeType: '',
          imageData: '',
          notes: current[assignmentId]?.notes || ''
        }
      }));
      return;
    }

    try {
      const imageData = await fileToDataUrl(file);
      setFieldEvidenceDrafts((current) => ({
        ...current,
        [assignmentId]: {
          ...(current[assignmentId] || {}),
          fileName: file.name,
          mimeType: file.type || 'image/png',
          imageData
        }
      }));
    } catch (error) {
      console.error(error);
      setFieldSyncMessage(error.message || 'Failed to prepare evidence image.');
    }
  };

  const handleFieldEvidenceNotesChange = (assignmentId, notes) => {
    setFieldEvidenceDrafts((current) => ({
      ...current,
      [assignmentId]: {
        ...(current[assignmentId] || {}),
        notes
      }
    }));
  };

  const handleFieldEvidenceUpload = async (assignment) => {
    const draft = fieldEvidenceDrafts[assignment.assignmentId];
    if (!draft?.imageData || !draft?.fileName) {
      setFieldSyncMessage(`Choose an image before uploading evidence for ${assignment.needTitle}.`);
      return;
    }

    const payload = {
      fileName: draft.fileName,
      mimeType: draft.mimeType,
      imageData: draft.imageData,
      notes: draft.notes || '',
      uploadedAt: new Date().toISOString()
    };
    const operation = {
      type: 'evidence',
      assignmentId: assignment.assignmentId,
      endpoint: `http://localhost:8000/api/assignments/${encodeURIComponent(assignment.assignmentId)}/evidence`,
      method: 'POST',
      payload,
      previewId: `offline-evidence-${Date.now()}`
    };

    const queueEvidence = (message) => {
      queueOfflineFieldOp(operation);
      setOfflineOpsCount(readOfflineFieldOpsQueue().length);
      setFieldAssignments((current) => applyOfflineFieldOp(current, operation));
      setFieldEvidenceDrafts((current) => ({
        ...current,
        [assignment.assignmentId]: {
          fileName: '',
          mimeType: '',
          imageData: '',
          notes: ''
        }
      }));
      setFieldSyncMessage(message);
    };

    if (isOffline) {
      queueEvidence(`Offline mode is active. Evidence for ${assignment.needTitle} has been queued locally.`);
      return;
    }

    setFieldEvidenceUploadingId(assignment.assignmentId);
    try {
      const token = await getToken();
      await postJson(operation.endpoint, payload, { token, timeoutMs: 30000 });

      setFieldEvidenceDrafts((current) => ({
        ...current,
        [assignment.assignmentId]: {
          fileName: '',
          mimeType: '',
          imageData: '',
          notes: ''
        }
      }));
      setFieldSyncMessage(`Field evidence uploaded successfully for ${assignment.needTitle}.`);
      await loadFieldAssignments();
      window.dispatchEvent(new Event('resourcesync:data-changed'));
    } catch (error) {
      console.error(error);
      queueEvidence(`Connection dropped while uploading evidence for ${assignment.needTitle}. It has been stored locally and will sync when online. ${error.message}`);
    } finally {
      setFieldEvidenceUploadingId(null);
    }
  };

  if (!canRegisterVolunteers) {
    return (
      <div className="page-shell" style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div className="glass-panel" style={{ padding: '2.6rem', textAlign: 'center', display: 'grid', gap: '1rem' }}>
          <ShieldAlert size={42} color="var(--accent-orange)" style={{ margin: '0 auto' }} />
          <h2>Volunteer Management Restricted</h2>
          <p className="text-muted" style={{ maxWidth: '54ch', margin: '0 auto' }}>
            {currentUser?.role === 'viewer'
              ? 'Viewer accounts can explore the platform but cannot register or edit volunteer records.'
              : 'Your current role does not have volunteer management permissions.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide" style={{ maxWidth: '1180px', margin: '0 auto', display: 'grid', gap: '1.75rem' }}>
      <section
        className="glass-panel"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(1.6rem, 3.4vw, 2.8rem)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)',
          gap: '1.4rem',
          background: 'linear-gradient(135deg, rgba(0,198,255,0.1), rgba(8,10,18,0.96) 48%, rgba(255,209,102,0.08))'
        }}
      >
        <div style={{ position: 'absolute', inset: '-18% auto auto -8%', width: '20rem', height: '20rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,198,255,0.18), transparent 66%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 'auto -10% -28% auto', width: '22rem', height: '22rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,209,102,0.16), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: '1.1rem', alignContent: 'start' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.42rem 0.9rem', borderRadius: '999px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
            <Sparkles size={15} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Volunteer readiness, trust, and mission identity</span>
          </div>

          <div>
            <h1 className="text-gradient" style={{ fontSize: 'clamp(2.6rem, 5vw, 4.6rem)', lineHeight: 0.94 }}>
              Volunteer
              <br />
              Passport Portal
            </h1>
            <p className="text-muted" style={{ marginTop: '0.7rem', maxWidth: '58ch', fontSize: '1rem' }}>
              A more visual volunteer workspace that combines registration, trust credentials, training readiness, and mission contribution into one presentation-ready profile.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
            {readinessCards.map((item) => (
              <div key={item.label} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</p>
                <p style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.25rem' }}>{item.value}</p>
                <p style={{ fontSize: '0.82rem', color: item.accent, marginTop: '0.22rem' }}>{item.caption}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '1.15rem', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Activity Trend</p>
                <h3 style={{ marginTop: '0.25rem' }}>Mission momentum</h3>
              </div>
              <div style={{ padding: '0.38rem 0.75rem', borderRadius: '999px', background: 'rgba(0,255,136,0.1)', color: 'var(--accent-green)', fontSize: '0.78rem', fontWeight: 700 }}>
                +{Math.max((activityTrend.at(-1) || 0) - (activityTrend[0] || 0), 0)} growth
              </div>
            </div>

            <svg viewBox="0 0 320 140" style={{ width: '100%', height: '140px' }}>
              <defs>
                <linearGradient id="volunteerTrendStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--accent-cyan)" />
                  <stop offset="100%" stopColor="var(--accent-green)" />
                </linearGradient>
                <linearGradient id="volunteerTrendFill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(0,198,255,0.32)" />
                  <stop offset="100%" stopColor="rgba(0,198,255,0.02)" />
                </linearGradient>
              </defs>
              {[20, 50, 80, 110].map((y) => (
                <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 6" />
              ))}
              <path d={`${chartPath} L 310 120 L 10 120 Z`} fill="url(#volunteerTrendFill)" />
              <path d={chartPath} fill="none" stroke="url(#volunteerTrendStroke)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {activityTrend.map((point, index) => {
                const x = 10 + index * 60;
                const y = 120 - (point / Math.max(...activityTrend, 1)) * 90;
                return (
                  <g key={`${point}-${index}`}>
                    <circle cx={x} cy={y} r="5" fill="var(--accent-cyan)" />
                    <circle cx={x} cy={y} r="10" fill="rgba(0,198,255,0.12)" />
                  </g>
                );
              })}
            </svg>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '0.35rem' }}>
              {trendLabels.map((label, index) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <p className="text-muted" style={{ fontSize: '0.72rem' }}>{label}</p>
                  <p style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: '0.12rem' }}>{activityTrend[index]}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.9rem' }}>
            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Field fit</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem' }}>{profile?.recognitionLevel || 'Growing'}</p>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Trust-aware deployment status.</p>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Training status</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem' }}>{trainingSummary.badges.length || 0} badges</p>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Readiness credentials attached.</p>
            </div>
          </div>
        </div>
      </section>

      {!loadingProfile && profile ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(340px, 0.95fr)', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.35rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,209,102,0.05))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Verified Response Passport
                  </p>
                  <h2 style={{ marginTop: '0.28rem' }}>{profile.name}</h2>
                  <p className="text-muted" style={{ marginTop: '0.28rem', fontSize: '0.9rem' }}>
                    {profile.skill} • {profile.location} • within {profile.radius} miles
                  </p>
                </div>
                <div style={{ padding: '0.48rem 0.8rem', borderRadius: '999px', background: 'rgba(255,209,102,0.12)', color: '#ffd166', fontSize: '0.8rem', fontWeight: 700 }}>
                  {profile.rewardTier || 'Bronze Responder'}
                </div>
              </div>

              {submitted ? (
                <div className="glass-panel animate-fade-in" style={{ padding: '0.95rem 1rem', display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(0,255,136,0.06)', borderColor: 'rgba(0,255,136,0.18)' }}>
                  <CheckCircle size={20} color="var(--accent-green)" />
                  <p style={{ fontWeight: 700 }}>Volunteer profile saved successfully.</p>
                </div>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.8rem' }}>
                {[
                  { label: 'Reward Points', value: profile.rewardPoints || 0, icon: Trophy },
                  { label: 'This Month', value: profile.monthlyPoints || 0, icon: TrendingUp },
                  { label: 'Verified', value: profile.verifiedCompletions || 0, icon: CheckCircle },
                  { label: 'Reliability', value: `${profile.reliabilityScore || 0}/100`, icon: Target }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Icon size={15} color="var(--accent-cyan)" />
                        <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                      </div>
                      <p style={{ fontSize: '1.45rem', fontWeight: 800, marginTop: '0.32rem' }}>{item.value}</p>
                    </div>
                  );
                })}
              </div>

              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.7rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <p style={{ fontWeight: 700 }}>Passport Breakdown</p>
                  <span style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', background: 'rgba(0,198,255,0.12)', color: 'var(--accent-cyan)', fontSize: '0.78rem', fontWeight: 700 }}>
                    {profile.recognitionLevel || 'Building Trust'}
                  </span>
                </div>
                {passportChecks.map((item) => (
                  <div key={item.label} className="glass-panel" style={{ padding: '0.88rem 0.95rem', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.88rem' }}>{item.label}</p>
                      <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.18rem' }}>{item.detail}</p>
                    </div>
                    <span style={{
                      padding: '0.32rem 0.68rem',
                      borderRadius: '999px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      background: item.value ? 'rgba(0,255,136,0.12)' : 'rgba(255,149,0,0.12)',
                      color: item.value ? 'var(--accent-green)' : 'var(--accent-orange)'
                    }}>
                      {item.value ? 'Met' : 'Growing'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.35rem', display: 'grid', gap: '1rem', background: 'rgba(255,255,255,0.025)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h3>Training and Trust Assets</h3>
                  <p className="text-muted" style={{ fontSize: '0.86rem', marginTop: '0.24rem' }}>
                    Credentials from the training center continue to strengthen deployment trust here.
                  </p>
                </div>
                <Link to="/training" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <GraduationCap size={16} />
                  Open Training
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.85rem' }}>
                {[
                  { label: 'Badges', value: trainingSummary.badges.length },
                  { label: 'Courses', value: trainingSummary.completedCourses.length },
                  { label: 'Certificates', value: trainingSummary.certificates.length }
                ].map((item) => (
                  <div key={item.label} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>{item.label}</p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.22rem' }}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {(profile.certifications || trainingSummary.badges || []).length ? (
                  (profile.certifications || trainingSummary.badges || []).map((badge) => (
                    <span key={badge} style={{ padding: '0.48rem 0.78rem', borderRadius: '999px', background: 'rgba(255,209,102,0.12)', color: '#ffd166', fontSize: '0.8rem', fontWeight: 700 }}>
                      {badge}
                    </span>
                  ))
                ) : (
                  <span className="text-muted" style={{ fontSize: '0.84rem' }}>No certifications attached yet.</span>
                )}
              </div>

              {(profile.achievements || []).length ? (
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  {profile.achievements.map((achievement) => (
                    <span key={achievement} style={{ padding: '0.42rem 0.75rem', borderRadius: '999px', background: 'rgba(0,198,255,0.12)', color: 'var(--accent-cyan)', fontSize: '0.8rem', fontWeight: 700 }}>
                      {achievement}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="glass-panel" style={{ padding: '1.35rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,198,255,0.05))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Offline-first field mode
                  </p>
                  <h3 style={{ marginTop: '0.28rem' }}>My field operations</h3>
                  <p className="text-muted" style={{ fontSize: '0.86rem', marginTop: '0.24rem', maxWidth: '60ch' }}>
                    Your assignment actions keep working even with poor connectivity. Status changes and evidence uploads can be queued locally and synced automatically when the network returns.
                  </p>
                </div>
                <div className="glass-panel" style={{ padding: '0.75rem 0.9rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Queued ops</p>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800 }}>{offlineOpsCount}</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1rem 1.05rem', background: isOffline ? 'rgba(255,149,0,0.08)' : 'rgba(0,255,136,0.06)', borderColor: isOffline ? 'rgba(255,149,0,0.24)' : 'rgba(0,255,136,0.18)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    {isOffline ? <WifiOff size={18} color="var(--accent-orange)" /> : <Wifi size={18} color="var(--accent-green)" />}
                    <div>
                      <p style={{ fontWeight: 700 }}>{isOffline ? 'Offline queue active' : syncingFieldOps ? 'Syncing queued field actions...' : 'Live sync active'}</p>
                      <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.15rem' }}>
                        {isOffline
                          ? 'You can still move assignments forward and attach evidence. The portal will safely replay those actions later.'
                          : 'Assignments, evidence, and local field updates will synchronize automatically.'}
                      </p>
                    </div>
                  </div>
                  {profile?.radius ? (
                    <div style={{ padding: '0.42rem 0.75rem', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', fontWeight: 700 }}>
                      Within {profile.radius} miles
                    </div>
                  ) : null}
                </div>
                {fieldSyncMessage ? (
                  <p style={{ marginTop: '0.7rem', fontSize: '0.82rem', color: isOffline ? 'var(--accent-orange)' : 'var(--accent-cyan)' }}>
                    {fieldSyncMessage}
                  </p>
                ) : null}
              </div>

              <div style={{ display: 'grid', gap: '0.9rem' }}>
                {fieldAssignmentsLoading ? (
                  <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-muted">Loading your current field assignments...</p>
                  </div>
                ) : null}

                {!fieldAssignmentsLoading && !fieldAssignments.length ? (
                  <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                    <p style={{ fontWeight: 700 }}>No live assignments yet.</p>
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.22rem' }}>
                      Once a coordinator assigns work to this profile, it will appear here as your offline-capable field workspace.
                    </p>
                  </div>
                ) : null}

                {fieldAssignments.map((assignment) => (
                  <div key={assignment.assignmentId} className="glass-panel" style={{ padding: '1rem 1.05rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                          <span style={{ padding: '0.26rem 0.72rem', borderRadius: '999px', background: assignment.urgency === 'Critical' ? 'rgba(255,59,48,0.12)' : assignment.urgency === 'High' ? 'rgba(255,149,0,0.14)' : 'rgba(0,198,255,0.14)', color: assignment.urgency === 'Critical' ? 'var(--accent-red)' : assignment.urgency === 'High' ? 'var(--accent-orange)' : 'var(--accent-cyan)', fontSize: '0.76rem', fontWeight: 700 }}>
                            {assignment.urgency}
                          </span>
                          {assignment.offlinePending ? (
                            <span style={{ padding: '0.26rem 0.72rem', borderRadius: '999px', background: 'rgba(255,209,102,0.12)', color: '#ffd166', fontSize: '0.76rem', fontWeight: 700 }}>
                              Pending sync
                            </span>
                          ) : null}
                        </div>
                        <p style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.45rem' }}>{assignment.needTitle}</p>
                        <p className="text-muted" style={{ fontSize: '0.83rem', marginTop: '0.2rem' }}>
                          {assignment.location} • {assignment.category}
                        </p>
                      </div>
                      <div style={{ minWidth: '170px', textAlign: 'right' }}>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current status</p>
                        <p style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.22rem' }}>{assignment.statusLabel}</p>
                        {assignment.lastOfflineAction ? (
                          <p className="text-muted" style={{ fontSize: '0.76rem', marginTop: '0.18rem' }}>{assignment.lastOfflineAction}</p>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: '0.85rem', alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Mission status</label>
                        <select
                          value={assignment.status}
                          onChange={(event) => handleFieldAssignmentStatusChange(assignment, event.target.value)}
                          className="input-field"
                          disabled={fieldStatusUpdatingId === assignment.assignmentId}
                          style={{ appearance: 'none' }}
                        >
                          {fieldStatusOptions.map((status) => (
                            <option key={status} value={status}>{formatAssignmentStatus(status)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="glass-panel" style={{ padding: '0.85rem 0.95rem', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Radio size={15} color="var(--accent-cyan)" />
                          <p style={{ fontWeight: 700, fontSize: '0.86rem' }}>Field sync status</p>
                        </div>
                        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.22rem' }}>
                          {assignment.offlinePending
                            ? 'This assignment has at least one local action waiting to sync.'
                            : 'This assignment is fully synchronized with Mission Control.'}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ fontWeight: 700 }}>Field evidence</p>
                          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.16rem' }}>
                            Capture on-site proof even when signal is unreliable.
                          </p>
                        </div>
                        <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {assignment.evidence?.length || 0} evidence file{assignment.evidence?.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {assignment.evidence?.length ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                          {assignment.evidence.map((item) => (
                            <div key={item.id} className="glass-panel" style={{ padding: '0.7rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '0.5rem' }}>
                              <img src={item.imageData} alt={item.fileName || 'Field evidence'} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: '10px' }} />
                              <div>
                                <p style={{ fontSize: '0.8rem', fontWeight: 700 }}>{item.fileName || 'Evidence image'}</p>
                                <p className="text-muted" style={{ fontSize: '0.74rem', marginTop: '0.16rem' }}>
                                  {item.pendingSync ? 'Waiting to sync' : formatDateTime(item.uploadedAt)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'end' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Evidence image</label>
                          <label className="input-field" style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer' }}>
                            <Upload size={15} color="var(--accent-cyan)" />
                            <span style={{ color: fieldEvidenceDrafts[assignment.assignmentId]?.fileName ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {fieldEvidenceDrafts[assignment.assignmentId]?.fileName || 'Choose image'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(event) => handleFieldEvidenceDraftChange(assignment.assignmentId, event.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Evidence notes</label>
                          <input
                            type="text"
                            className="input-field"
                            value={fieldEvidenceDrafts[assignment.assignmentId]?.notes || ''}
                            onChange={(event) => handleFieldEvidenceNotesChange(assignment.assignmentId, event.target.value)}
                            placeholder="What does this image prove?"
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleFieldEvidenceUpload(assignment)}
                          disabled={fieldEvidenceUploadingId === assignment.assignmentId}
                          style={{ padding: '10px 16px', fontSize: '0.84rem' }}
                        >
                          {fieldEvidenceUploadingId === assignment.assignmentId ? 'Uploading...' : 'Save Evidence'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.45rem', background: 'rgba(255,255,255,0.025)' }}>
            <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <h3>Editable Profile</h3>
                <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.24rem' }}>
                  Your registration form becomes a living profile that you can refine as your field identity evolves.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gap: '0.28rem' }}>
                <p style={{ fontWeight: 700 }}>{profile.email || currentUser?.email || 'Signed-in volunteer'}</p>
                <p className="text-muted" style={{ fontSize: '0.83rem' }}>
                  This account owns the passport and trust signals shown on this page.
                </p>
              </div>

              <Field label="Full Name">
                <input name="name" required type="text" className="input-field" value={formValues.name} onChange={handleFieldChange} />
              </Field>

              <Field label="Primary Skillset">
                <select name="skill" className="input-field" style={{ appearance: 'none' }} value={formValues.skill} onChange={handleFieldChange}>
                  <option value="">Select your strongest skill...</option>
                  <option value="Medical">Medical Professional / First Aid</option>
                  <option value="Logistics">Logistics / Driving / Sorting</option>
                  <option value="Education">Education / Tutoring / Childcare</option>
                  <option value="Labor">Manual Labor / Construction</option>
                  <option value="Food">Food Distribution / Kitchen Support</option>
                </select>
              </Field>

              <Field label="Current Location / Zip Code">
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input name="location" required type="text" className="input-field" value={formValues.location} onChange={handleFieldChange} style={{ paddingLeft: '42px' }} />
                </div>
              </Field>

              <Field label="Availability Radius">
                <select name="radius" className="input-field" style={{ appearance: 'none' }} value={String(formValues.radius)} onChange={handleFieldChange}>
                  <option value="5">Within 5 miles</option>
                  <option value="15">Within 15 miles</option>
                  <option value="50">Anywhere in the region</option>
                </select>
              </Field>

              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn-primary" disabled={savingProfile} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', flex: 1 }}>
                  {savingProfile ? <CheckCircle size={18} /> : <Save size={18} />}
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={savingProfile}
                  onClick={() => setFormValues({
                    name: profile.name || '',
                    skill: profile.skill || '',
                    location: profile.location || '',
                    radius: Number(profile.radius) || 5
                  })}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
                >
                  <PencilLine size={18} />
                  Reset Edits
                </button>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleDeleteProfile}
                disabled={deletingProfile}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '16px',
                  borderColor: 'rgba(255, 99, 132, 0.35)',
                  color: 'var(--accent-red)'
                }}
              >
                <Trash2 size={18} />
                {deletingProfile ? 'Deleting Profile...' : 'Delete Volunteer Profile'}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {!loadingProfile && !profile ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(320px, 1.05fr)', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.8rem', display: 'grid', gap: '1rem', background: 'rgba(255,255,255,0.025)' }}>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Why join</p>
              <h2 style={{ marginTop: '0.3rem' }}>Activate your volunteer identity</h2>
              <p className="text-muted" style={{ fontSize: '0.92rem', marginTop: '0.35rem' }}>
                Register once to unlock a living profile, activity passport, trust signals, and training-linked deployment readiness.
              </p>
            </div>

            {[
              {
                icon: Heart,
                title: 'Make visible impact',
                body: 'Track how your work translates into verified response momentum and recognition.'
              },
              {
                icon: Search,
                title: 'Improve match quality',
                body: 'Coordinators can align your skills, location, and badges with the right type of mission.'
              },
              {
                icon: GraduationCap,
                title: 'Grow your trust profile',
                body: 'Training badges and verified completions make your passport stronger over time.'
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.8rem' }}>
                  <div style={{ width: '2.6rem', height: '2.6rem', borderRadius: '16px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                    <Icon size={18} color="var(--accent-cyan)" />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700 }}>{item.title}</p>
                    <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.22rem' }}>{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="glass-panel" style={{ padding: '1.8rem', background: 'rgba(255,255,255,0.025)' }}>
            {submitted ? (
              <div className="animate-fade-in" style={{ display: 'grid', placeItems: 'center', minHeight: '420px', textAlign: 'center', gap: '1rem' }}>
                <CheckCircle size={64} color="var(--accent-cyan)" />
                <div>
                  <h3>Profile Activated!</h3>
                  <p className="text-muted" style={{ fontSize: '0.95rem', marginTop: '0.35rem' }}>
                    Your volunteer passport is now live and will continue to grow as you train and complete missions.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateProfile} style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <h3>Volunteer Registration</h3>
                  <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.24rem' }}>
                    Start with the essentials. After activation, this form is replaced by your richer profile and passport view.
                  </p>
                </div>

                <Field label="Full Name">
                  <input name="name" required type="text" className="input-field" placeholder="Jane Doe" value={formValues.name} onChange={handleFieldChange} />
                </Field>

                <Field label="Primary Skillset">
                  <select name="skill" className="input-field" style={{ appearance: 'none' }} value={formValues.skill} onChange={handleFieldChange}>
                    <option value="">Select your strongest skill...</option>
                    <option value="Medical">Medical Professional / First Aid</option>
                    <option value="Logistics">Logistics / Driving / Sorting</option>
                    <option value="Education">Education / Tutoring / Childcare</option>
                    <option value="Labor">Manual Labor / Construction</option>
                    <option value="Food">Food Distribution / Kitchen Support</option>
                  </select>
                </Field>

                <Field label="Current Location / Zip Code">
                  <input name="location" required type="text" className="input-field" placeholder="e.g. 90210" value={formValues.location} onChange={handleFieldChange} />
                </Field>

                <Field label="Availability Radius">
                  <select name="radius" className="input-field" style={{ appearance: 'none' }} value={String(formValues.radius)} onChange={handleFieldChange}>
                    <option value="5">Within 5 miles</option>
                    <option value="15">Within 15 miles</option>
                    <option value="50">Anywhere in the region</option>
                  </select>
                </Field>

                <button type="submit" className="btn-primary" disabled={savingProfile} style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}>
                  <UserPlus size={18} />
                  {savingProfile ? 'Activating...' : 'Activate Profile'}
                </button>
              </form>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

function buildActivityTrend(profile) {
  const completions = Number(profile?.verifiedCompletions || 0);
  const momentum = Number(profile?.monthlyPoints || 0);
  const reliability = Number(profile?.reliabilityScore || 0);
  const missions = Number(profile?.missionsCompleted || 0);

  return [1, 2, 3, 4, 5, 6].map((step, index) => (
    Math.max(
      2,
      Math.round(
        (completions * (index >= 3 ? 1.2 : 0.8)) +
        (missions / 3) +
        (momentum / 40) +
        (reliability / 18) +
        step
      )
    )
  ));
}

function buildSparklinePath(points) {
  const maxValue = Math.max(...points, 1);
  return points.map((point, index) => {
    const x = 10 + index * 60;
    const y = 120 - (point / maxValue) * 90;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
}

function buildReadinessCards(profile, trainingSummary) {
  return [
    {
      label: 'Passport Score',
      value: `${profile?.reliabilityScore || 0}/100`,
      caption: profile?.recognitionLevel || 'Building trust',
      accent: 'var(--accent-cyan)'
    },
    {
      label: 'Verified Missions',
      value: profile?.verifiedCompletions || 0,
      caption: `${profile?.evidenceBackedVerifications || 0} evidence-backed`,
      accent: 'var(--accent-green)'
    },
    {
      label: 'Training Assets',
      value: trainingSummary.badges.length + trainingSummary.certificates.length,
      caption: `${trainingSummary.badges.length} badges active`,
      accent: 'var(--accent-orange)'
    }
  ];
}

function buildPassportChecks(profile, trainingSummary) {
  const certifications = (profile?.certifications || trainingSummary.badges || []).length;
  const verifiedCompletions = Number(profile?.verifiedCompletions || 0);
  const evidenceBackedVerifications = Number(profile?.evidenceBackedVerifications || 0);
  const reliabilityScore = Number(profile?.reliabilityScore || 0);

  return [
    {
      label: 'Qualified for sensitive work',
      value: certifications > 0,
      detail: `${certifications} certification badge${certifications === 1 ? '' : 's'} attached`
    },
    {
      label: 'Verified delivery history',
      value: verifiedCompletions > 0,
      detail: `${verifiedCompletions} coordinator-verified completion${verifiedCompletions === 1 ? '' : 's'}`
    },
    {
      label: 'Evidence-backed proof trail',
      value: evidenceBackedVerifications > 0,
      detail: `${evidenceBackedVerifications} verification${evidenceBackedVerifications === 1 ? '' : 's'} supported by field evidence`
    },
    {
      label: 'Reliable assignment follow-through',
      value: reliabilityScore >= 75,
      detail: `Reliability score ${reliabilityScore}/100`
    }
  ];
}

async function postOrPatchOperation(operation, token) {
  if (operation.method === 'PATCH') {
    return patchJson(operation.endpoint, operation.payload, { token, timeoutMs: 20000 });
  }

  return postJson(operation.endpoint, operation.payload, { token, timeoutMs: 30000 });
}

function dataOrFallback(training) {
  return training || {
    badges: [],
    completedCourses: [],
    certificates: []
  };
}

function normalizeVolunteerAssignments(needs, volunteerId) {
  return needs
    .flatMap((need) => (need.currentAssignments || []).map((assignment) => ({
      assignmentId: assignment.id,
      volunteerId: assignment.volunteerId,
      needId: need.id,
      needTitle: need.translatedTitle || need.title,
      location: need.location,
      category: need.translatedCategory || need.category,
      urgency: need.translatedUrgency || need.urgency,
      status: assignment.status,
      statusLabel: assignment.statusLabel || formatAssignmentStatus(assignment.status),
      evidence: Array.isArray(assignment.evidence) ? assignment.evidence : [],
      offlinePending: false,
      lastOfflineAction: ''
    })))
    .filter((assignment) => String(assignment.volunteerId) === String(volunteerId))
    .sort((left, right) => {
      const urgencyOrder = ['Critical', 'High', 'Medium', 'Low'];
      const urgencyGap = urgencyOrder.indexOf(left.urgency) - urgencyOrder.indexOf(right.urgency);
      if (urgencyGap !== 0) {
        return urgencyGap;
      }

      return String(left.needTitle).localeCompare(String(right.needTitle));
    });
}

function formatDateTime(value) {
  if (!value) {
    return 'Pending timestamp';
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}
