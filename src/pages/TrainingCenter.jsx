import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  Flame,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const emptyTrainingState = {
  completedCourses: [],
  badges: [],
  certificates: [],
  attempts: []
};

const readinessLabels = {
  low: {
    title: 'Limited Deployment Readiness',
    body: 'This volunteer is still early in certification progress and should continue training before sensitive assignments.',
    color: 'var(--accent-orange)'
  },
  medium: {
    title: 'Operationally Ready',
    body: 'This volunteer has enough training progress to support supervised field work and category-specific assignments.',
    color: 'var(--accent-cyan)'
  },
  high: {
    title: 'Trusted Field Responder',
    body: 'This volunteer has strong certification coverage and visible readiness signals for live deployment scenarios.',
    color: 'var(--accent-green)'
  }
};

export default function TrainingCenter() {
  const { currentUser, getToken, hasPermission } = useAuth();
  const canAccessTraining = hasPermission('training_access');
  const [courses, setCourses] = useState([]);
  const [training, setTraining] = useState(emptyTrainingState);
  const [renewalReminders, setRenewalReminders] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || courses[0] || null,
    [courses, selectedCourseId]
  );

  const academyMetrics = useMemo(() => {
    const completedCount = training.completedCourses.length;
    const totalCourses = courses.length;
    const completionRate = totalCourses ? Math.round((completedCount / totalCourses) * 100) : 0;
    const latestAttempt = training.attempts
      .slice()
      .sort((left, right) => String(right.attemptedAt || '').localeCompare(String(left.attemptedAt || '')))[0];
    const averageScore = training.completedCourses.length
      ? Math.round(training.completedCourses.reduce((sum, item) => sum + Number(item.score || 0), 0) / training.completedCourses.length)
      : 0;
    const readinessScore = Math.min(
      100,
      (training.badges.length * 24) +
      (training.certificates.length * 18) +
      (completedCount * 12) +
      Math.min(averageScore, 20)
    );

    const readinessLevel = readinessScore >= 80 ? 'high' : readinessScore >= 45 ? 'medium' : 'low';

    return {
      completedCount,
      totalCourses,
      completionRate,
      averageScore,
      readinessScore,
      readinessLevel,
      latestAttempt
    };
  }, [courses, training]);

  const selectedCourseProgress = useMemo(() => {
    if (!selectedCourse) {
      return null;
    }

    const attempt = training.attempts.find((item) => item.courseId === selectedCourse.id);
    const completion = training.completedCourses.find((item) => item.courseId === selectedCourse.id);

    return {
      attempt,
      completion,
      isCompleted: Boolean(completion),
      questionCount: selectedCourse.assessment.length
    };
  }, [selectedCourse, training]);

  const deploymentMatrix = useMemo(() => {
    return courses.map((course) => {
      const completion = training.completedCourses.find((item) => item.courseId === course.id);
      const reminder = renewalReminders.find((item) => item.courseId === course.id);

      return {
        id: course.id,
        track: course.title,
        badge: course.badge,
        category: course.category,
        level: course.level,
        status: completion ? 'certified' : reminder?.reminderStatus === 'expired' ? 'expired' : 'pending',
        score: completion?.score || null,
        validUntil: completion?.validUntil || null
      };
    });
  }, [courses, renewalReminders, training]);

  const attemptHistory = useMemo(() => {
    return training.attempts
      .slice()
      .sort((left, right) => String(right.attemptedAt || '').localeCompare(String(left.attemptedAt || '')))
      .map((attempt) => {
        const course = courses.find((item) => item.id === attempt.courseId);
        return {
          ...attempt,
          title: course?.title || attempt.courseId
        };
      });
  }, [courses, training.attempts]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('http://localhost:8000/api/training/courses', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to load training courses');
      }

      setCourses(data.courses || []);
      setTraining(data.training || emptyTrainingState);
      setRenewalReminders(data.renewalReminders || []);
      setLeaderboard(data.leaderboard || []);
      setSelectedCourseId((current) => current || data.courses?.[0]?.id || '');
    } catch (error) {
      console.error(error);
      setFeedback(`Training center failed to load. ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccessTraining) {
      setLoading(false);
      return;
    }

    loadCourses();
  }, [canAccessTraining, currentUser?.uid]);

  useEffect(() => {
    setAnswers({});
    setFeedback('');
  }, [selectedCourseId]);

  const handleAnswerChange = (questionId, optionIndex) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: optionIndex
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedCourse) {
      return;
    }

    setSubmitting(true);
    setFeedback('');

    try {
      const token = await getToken();
      const response = await fetch(`http://localhost:8000/api/training/courses/${encodeURIComponent(selectedCourse.id)}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to submit training assessment');
      }

      setCourses(data.courses || []);
      setTraining(data.training || emptyTrainingState);
      setRenewalReminders(data.renewalReminders || []);
      setLeaderboard(data.leaderboard || []);
      setFeedback(
        data.result.passed
          ? `Passed with ${data.result.score}%. Badge earned: ${data.result.badge}.`
          : `Scored ${data.result.score}%. A 70% score is required to earn the badge, so you can retry this course.`
      );
    } catch (error) {
      console.error(error);
      setFeedback(`Assessment submission failed. ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadCertificate = (certificate) => {
    const blob = createCertificatePdfBlob({
      volunteerName: currentUser?.email || 'Volunteer',
      courseTitle: certificate.title,
      issuedAt: certificate.issuedAt,
      validUntil: certificate.validUntil
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${certificate.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-certificate.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!canAccessTraining) {
    return (
      <div className="glass-panel" style={{ maxWidth: '760px', margin: '0 auto', padding: '2.5rem', textAlign: 'center' }}>
        <ShieldAlert size={42} color="var(--accent-orange)" style={{ margin: '0 auto 1rem' }} />
        <h2 className="text-gradient">Training Access Restricted</h2>
        <p className="text-muted" style={{ marginTop: '0.7rem' }}>
          Only admins, coordinators, and field volunteers can enter the certification workspace.
        </p>
      </div>
    );
  }

  const readinessMeta = readinessLabels[academyMetrics.readinessLevel];

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '1.75rem' }}>
      <section
        className="glass-panel"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(1.6rem, 4vw, 2.2rem)',
          display: 'grid',
          gap: '1.5rem',
          background: 'linear-gradient(140deg, rgba(0, 240, 255, 0.09), rgba(8,12,20,0.92) 46%, rgba(255,209,102,0.06))'
        }}
      >
        <div style={{ position: 'absolute', inset: '-10% auto auto -8%', width: '20rem', height: '20rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,240,255,0.16), transparent 64%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 'auto -8% -20% auto', width: '22rem', height: '22rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,209,102,0.14), transparent 68%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
              <ShieldCheck size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Volunteer readiness academy</span>
            </div>

            <div>
              <h1 className="text-gradient" style={{ fontSize: 'clamp(2.6rem, 5vw, 4.8rem)', lineHeight: 0.94 }}>
                Training Center
              </h1>
              <p className="text-muted" style={{ marginTop: '0.7rem', maxWidth: '66ch' }}>
                A realistic certification workspace for volunteer readiness. It shows progression, trust credentials, expiry risk, field-fit scoring, and downloadable proof of training in one place.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1rem 1.1rem', background: 'rgba(255,255,255,0.03)' }}>
              <p style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: readinessMeta.color }}>Current readiness state</p>
              <p style={{ fontWeight: 800, fontSize: '1.2rem', marginTop: '0.3rem' }}>{readinessMeta.title}</p>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.35rem' }}>{readinessMeta.body}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.9rem' }}>
            {[
              {
                label: 'Readiness Score',
                value: academyMetrics.readinessScore,
                detail: 'Composite academy score',
                icon: <Target size={18} color="var(--accent-cyan)" />
              },
              {
                label: 'Completion Rate',
                value: `${academyMetrics.completionRate}%`,
                detail: `${academyMetrics.completedCount}/${academyMetrics.totalCourses} tracks complete`,
                icon: <BookOpen size={18} color="var(--accent-green)" />
              },
              {
                label: 'Average Score',
                value: academyMetrics.averageScore || '--',
                detail: 'Across passed assessments',
                icon: <Star size={18} color="var(--accent-orange)" />
              },
              {
                label: 'Certificates',
                value: training.certificates.length,
                detail: 'Downloadable proof records',
                icon: <FileCheck2 size={18} color="var(--accent-purple)" />
              }
            ].map((item) => (
              <div key={item.label} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ width: '2.3rem', height: '2.3rem', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                  {item.icon}
                </div>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                <p style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.15rem' }}>{item.value}</p>
                <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h3>Academy Overview</h3>
              <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
                Judges can understand the whole training system in one glance: learning, proof, renewal, and deployment trust.
              </p>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.85rem' }}>
              <Sparkles size={16} />
              Credential-driven workflow
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' }}>
            {[
              {
                title: 'Learn',
                body: 'Short operational modules focused on role boundaries and safe response behavior.',
                icon: <BookOpen size={18} color="var(--accent-cyan)" />
              },
              {
                title: 'Assess',
                body: 'Every track ends with a pass/fail knowledge check tied to a score threshold.',
                icon: <Target size={18} color="var(--accent-orange)" />
              },
              {
                title: 'Certify',
                body: 'Passing generates badges, certificates, and visible trust signals in the platform.',
                icon: <BadgeCheck size={18} color="var(--accent-green)" />
              },
              {
                title: 'Renew',
                body: 'Certificates expire and renewal reminders keep trust credentials current.',
                icon: <Clock3 size={18} color="var(--accent-purple)" />
              }
            ].map((item) => (
              <div key={item.title} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ width: '2.3rem', height: '2.3rem', borderRadius: '14px', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                  {item.icon}
                </div>
                <p style={{ fontWeight: 700, marginTop: '0.75rem' }}>{item.title}</p>
                <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,240,255,0.04))' }}>
          <div>
            <h3>Latest Assessment Activity</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
              Recent training movement makes the academy feel live and realistic.
            </p>
          </div>

          {academyMetrics.latestAttempt ? (
            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>
                {courses.find((course) => course.id === academyMetrics.latestAttempt.courseId)?.title || academyMetrics.latestAttempt.courseId}
              </p>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>
                Score: {academyMetrics.latestAttempt.score}% • {academyMetrics.latestAttempt.passed ? 'Passed' : 'Retry needed'}
              </p>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                Attempted {formatDateTime(academyMetrics.latestAttempt.attemptedAt)}
              </p>
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>No assessment attempts yet.</p>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
                Start a certification track below to activate the volunteer academy history.
              </p>
            </div>
          )}

          {renewalReminders.length ? renewalReminders.map((reminder) => (
            <div
              key={reminder.courseId}
              className="glass-panel"
              style={{
                padding: '1rem',
                background: reminder.reminderStatus === 'expired' ? 'rgba(255,82,82,0.08)' : 'rgba(255,149,0,0.08)',
                border: reminder.reminderStatus === 'expired' ? '1px solid rgba(255,82,82,0.25)' : '1px solid rgba(255,149,0,0.25)'
              }}
            >
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <AlertTriangle size={18} color={reminder.reminderStatus === 'expired' ? '#ff8a8a' : '#ffc266'} style={{ marginTop: '2px' }} />
                <div>
                  <p style={{ fontWeight: 700 }}>{reminder.title}</p>
                  <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>{reminder.message}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>No renewals due soon.</p>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
                Certification health is clean right now, which strengthens assignment trust.
              </p>
            </div>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.85fr) minmax(0, 1.15fr)', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
            <div>
              <h3>Certification Tracks</h3>
              <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
                Each track is framed like a serious operational credential, not just a tutorial.
              </p>
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <LoaderCircle size={18} className="spinning" color="var(--accent-cyan)" />
                <p className="text-muted">Loading academy tracks...</p>
              </div>
            ) : courses.map((course) => {
              const completion = training.completedCourses.find((item) => item.courseId === course.id);
              const active = selectedCourse?.id === course.id;
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => setSelectedCourseId(course.id)}
                  className="glass-panel"
                  style={{
                    textAlign: 'left',
                    padding: '1rem',
                    border: active ? '1px solid rgba(0,240,255,0.32)' : '1px solid var(--glass-border)',
                    background: completion ? 'rgba(0, 200, 160, 0.08)' : 'rgba(255,255,255,0.025)',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: '0.65rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 700 }}>{course.title}</p>
                      <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                        {course.category} • {course.level} • {course.duration}
                      </p>
                    </div>
                    <span style={{
                      padding: '0.35rem 0.7rem',
                      borderRadius: '999px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      background: completion ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.05)',
                      color: completion ? 'var(--accent-green)' : 'var(--text-muted)'
                    }}>
                      {completion ? `${completion.score}% certified` : 'Pending'}
                    </span>
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.84rem' }}>{course.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--accent-orange)' }}>Badge: {course.badge}</span>
                    <span style={{ fontSize: '0.78rem', color: active ? 'var(--accent-cyan)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {active ? 'Selected' : 'Open track'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
            <div>
              <h3>Earned Badges</h3>
              <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
                These become the visible trust layer that the assignment engine and coordinators can rely on.
              </p>
            </div>

            {training.badges.length ? training.badges.map((badge) => (
              <div key={badge} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Award size={18} color="var(--accent-orange)" />
                <div>
                  <p style={{ fontWeight: 700 }}>{badge}</p>
                  <p className="text-muted" style={{ fontSize: '0.82rem' }}>Visible on the volunteer trust record and used during assignment decisions.</p>
                </div>
              </div>
            )) : (
              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ fontWeight: 700 }}>No badges earned yet.</p>
                <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
                  Complete one of the certification tracks to unlock your first readiness credential.
                </p>
              </div>
            )}
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,149,0,0.05))' }}>
            <div>
              <h3>Deployment Trust Matrix</h3>
              <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
                A judge-friendly view of which response categories are certified, pending, or at renewal risk.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {deploymentMatrix.map((row) => (
                <div key={row.id} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 700 }}>{row.track}</p>
                      <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                        {row.category} • {row.level} • {row.badge}
                      </p>
                    </div>
                    <span style={{
                      padding: '0.35rem 0.7rem',
                      borderRadius: '999px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      background: row.status === 'certified'
                        ? 'rgba(0,255,136,0.12)'
                        : row.status === 'expired'
                          ? 'rgba(255,82,82,0.12)'
                          : 'rgba(255,149,0,0.12)',
                      color: row.status === 'certified'
                        ? 'var(--accent-green)'
                        : row.status === 'expired'
                          ? 'var(--accent-red)'
                          : 'var(--accent-orange)'
                    }}>
                      {row.status}
                    </span>
                  </div>
                  {row.score ? (
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>
                      Last certified score: {row.score}%{row.validUntil ? ` • valid until ${formatDate(row.validUntil)}` : ''}
                    </p>
                  ) : (
                    <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>
                      This trust credential has not been earned yet.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.6rem', display: 'grid', gap: '1.25rem' }}>
          {selectedCourse ? (
            <>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                  <span style={{ padding: '0.3rem 0.8rem', borderRadius: '999px', background: 'rgba(0,240,255,0.12)', color: 'var(--accent-cyan)', fontSize: '0.78rem', fontWeight: 700 }}>
                    {selectedCourse.level}
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.82rem' }}>{selectedCourse.category} readiness track</span>
                </div>
                <h2 style={{ marginTop: '0.85rem' }}>{selectedCourse.title}</h2>
                <p className="text-muted" style={{ marginTop: '0.45rem', maxWidth: '64ch' }}>{selectedCourse.description}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' }}>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Track status</p>
                  <p style={{ fontWeight: 800, fontSize: '1.15rem', marginTop: '0.3rem' }}>
                    {selectedCourseProgress?.isCompleted ? 'Certified' : 'In Progress'}
                  </p>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Questions</p>
                  <p style={{ fontWeight: 800, fontSize: '1.15rem', marginTop: '0.3rem' }}>{selectedCourseProgress?.questionCount || 0}</p>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Badge reward</p>
                  <p style={{ fontWeight: 800, fontSize: '1.15rem', marginTop: '0.3rem' }}>{selectedCourse.badge}</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ fontWeight: 700, marginBottom: '0.55rem' }}>What you will prove</p>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {selectedCourse.outcomes.map((outcome) => (
                    <div key={outcome} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                      <CheckCircle2 size={16} color="var(--accent-green)" style={{ marginTop: '2px' }} />
                      <p className="text-muted" style={{ fontSize: '0.86rem' }}>{outcome}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCourseProgress?.attempt ? (
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontWeight: 700 }}>Last Recorded Attempt</p>
                      <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>
                        {selectedCourseProgress.attempt.score}% • {selectedCourseProgress.attempt.passed ? 'Passed' : 'Retry required'}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatDateTime(selectedCourseProgress.attempt.attemptedAt)}
                    </span>
                  </div>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <Sparkles size={18} color="var(--accent-purple)" />
                    Knowledge Check
                  </h3>
                  <p className="text-muted" style={{ fontSize: '0.86rem', marginTop: '0.25rem' }}>
                    Score at least 70% to earn the badge, activate the certificate, and raise your deployment trust profile.
                  </p>
                </div>

                {selectedCourse.assessment.map((question, index) => (
                  <div key={question.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                    <p style={{ fontWeight: 700, marginBottom: '0.8rem' }}>{index + 1}. {question.question}</p>
                    <div style={{ display: 'grid', gap: '0.6rem' }}>
                      {question.options.map((option, optionIndex) => (
                        <label
                          key={option}
                          style={{
                            display: 'flex',
                            gap: '0.7rem',
                            alignItems: 'flex-start',
                            padding: '0.75rem 0.9rem',
                            borderRadius: '14px',
                            border: answers[question.id] === optionIndex ? '1px solid rgba(0,240,255,0.32)' : '1px solid var(--glass-border)',
                            background: answers[question.id] === optionIndex ? 'rgba(0,240,255,0.07)' : 'rgba(255,255,255,0.015)',
                            cursor: 'pointer'
                          }}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            checked={answers[question.id] === optionIndex}
                            onChange={() => handleAnswerChange(question.id, optionIndex)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: '14px 18px' }}>
                  {submitting ? 'Submitting Assessment...' : 'Submit Assessment'}
                </button>
              </form>

              {feedback ? (
                <div className="glass-panel" style={{ padding: '1rem', background: feedback.startsWith('Passed') ? 'rgba(0, 200, 160, 0.08)' : 'rgba(255,149,0,0.08)' }}>
                  <p style={{ fontWeight: 700 }}>{feedback}</p>
                </div>
              ) : null}

              <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h3>Certificate Vault</h3>
                    <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>
                      Downloadable PDF certificates for earned training completions.
                    </p>
                  </div>
                  <BadgeCheck size={18} color="var(--accent-green)" />
                </div>

                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                  {training.certificates.length ? training.certificates.map((certificate) => (
                    <div key={certificate.courseId} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ fontWeight: 700 }}>{certificate.title}</p>
                          <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                            Issued {formatDate(certificate.issuedAt)} • Valid until {formatDate(certificate.validUntil)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleDownloadCertificate(certificate)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Download size={16} />
                          Download PDF
                        </button>
                      </div>
                    </div>
                  )) : (
                    <p className="text-muted">No certificates available yet. Pass a certification course to unlock one.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted">No training course selected yet.</p>
          )}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.6rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h3>Trained Volunteer Leaderboard</h3>
              <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
                Highlights volunteers combining certifications with strong field contribution.
              </p>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-green)', fontWeight: 700 }}>
              <Trophy size={18} />
              Training-ranked responders
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.9rem' }}>
            {leaderboard.length ? leaderboard.map((volunteer, index) => (
              <div key={volunteer.id} className="glass-panel" style={{ padding: '1rem 1.1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1rem', alignItems: 'center' }}>
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '999px',
                  display: 'grid',
                  placeItems: 'center',
                  background: index === 0 ? 'linear-gradient(135deg, #ffd60a, #ff9500)' : 'rgba(255,255,255,0.08)',
                  color: index === 0 ? '#111' : 'var(--text-primary)',
                  fontWeight: 800
                }}>
                  {index + 1}
                </div>

                <div>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <p style={{ fontWeight: 700 }}>{volunteer.name}</p>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>{volunteer.skill}</span>
                    {index < 3 ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-orange)', fontSize: '0.78rem', fontWeight: 700 }}>
                        <Flame size={13} />
                        Top tier
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', marginTop: '0.35rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <BadgeCheck size={14} />
                      {volunteer.certificationCount} certifications
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock3 size={14} />
                      {volunteer.hoursVolunteered} hrs
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Award size={14} />
                      {(volunteer.certifications || []).join(', ')}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p className="text-muted" style={{ fontSize: '0.76rem' }}>Training Score</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{volunteer.trainingScore}</p>
                </div>
              </div>
            )) : (
              <p className="text-muted">No trained volunteers ranked yet.</p>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.6rem', display: 'grid', gap: '1rem', background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(138,43,226,0.04))' }}>
          <div>
            <h3>Assessment History</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.25rem' }}>
              A small but realistic audit trail of learning attempts makes the academy feel much more enterprise-grade.
            </p>
          </div>

          {attemptHistory.length ? attemptHistory.map((attempt) => (
            <div key={`${attempt.courseId}-${attempt.attemptedAt}`} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontWeight: 700 }}>{attempt.title}</p>
                  <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                    Attempted {formatDateTime(attempt.attemptedAt)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 800, color: attempt.passed ? 'var(--accent-green)' : 'var(--accent-orange)' }}>{attempt.score}%</p>
                  <p className="text-muted" style={{ fontSize: '0.78rem' }}>{attempt.passed ? 'Passed' : 'Retry needed'}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>No attempt history yet.</p>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
                Once a volunteer starts the academy, every assessment attempt appears here as a learning record.
              </p>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <ArrowUpRight size={16} color="var(--accent-cyan)" />
              <p style={{ fontWeight: 700 }}>Judge-friendly narrative</p>
            </div>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.45rem' }}>
              “Our platform does not treat volunteers as a generic pool. It verifies capability through certifications, tracks renewal risk, keeps downloadable proof records, and feeds those trust signals back into assignment decisions.”
            </p>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function formatDate(value) {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
}

function createCertificatePdfBlob({ volunteerName, courseTitle, issuedAt, validUntil }) {
  const contentStream = [
    'BT',
    '/F1 24 Tf 72 740 Td (ResourceSync Volunteer Certification) Tj',
    '/F1 14 Tf 0 -48 Td (Awarded to:) Tj',
    '/F1 18 Tf 0 -24 Td (' + escapePdfText(volunteerName) + ') Tj',
    '/F1 14 Tf 0 -40 Td (Certificate:) Tj',
    '/F1 16 Tf 0 -24 Td (' + escapePdfText(courseTitle) + ') Tj',
    '/F1 12 Tf 0 -40 Td (' + escapePdfText(`Issued on: ${formatDate(issuedAt)}`) + ') Tj',
    '0 -20 Td (' + escapePdfText(`Valid until: ${formatDate(validUntil)}`) + ') Tj',
    '0 -32 Td (' + escapePdfText('This document confirms successful completion of the required training module.') + ') Tj',
    'ET'
  ].join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });

  const xrefPosition = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}
