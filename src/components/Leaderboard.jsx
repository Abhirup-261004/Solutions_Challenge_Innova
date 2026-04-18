import { useMemo, useState } from 'react';
import { Award, Clock3, Flame, ShieldCheck, Trophy } from 'lucide-react';

const periodOptions = [
  { value: 'weekly', label: 'This Week' },
  { value: 'monthly', label: 'This Month' },
  { value: 'all', label: 'All Time' }
];

export default function Leaderboard({ volunteers }) {
  const [period, setPeriod] = useState('weekly');

  const rankedVolunteers = useMemo(() => {
    const list = [...volunteers];
    const getScore = (volunteer) => {
      if (period === 'weekly') return Number(volunteer.weeklyPoints || 0);
      if (period === 'monthly') return Number(volunteer.monthlyPoints || 0);
      return Number(volunteer.rewardPoints || volunteer.impactScore || 0);
    };

    return list
      .sort((left, right) => {
        const scoreGap = getScore(right) - getScore(left);
        if (scoreGap !== 0) {
          return scoreGap;
        }

        return Number(right.missionsCompleted || 0) - Number(left.missionsCompleted || 0);
      });
  }, [period, volunteers]);

  return (
    <div className="glass-panel" style={{ padding: '2rem', display: 'grid', gap: '1.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h3>Volunteer Rewards Leaderboard</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Recognizes volunteers for sustained, verified contribution across weekly and monthly windows.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-green)' }}>
          <Trophy size={18} />
          <span style={{ fontWeight: 700 }}>Recognition Engine</span>
        </div>
      </div>

      <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        {periodOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriod(option.value)}
            className={period === option.value ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '10px 14px', fontSize: '0.84rem' }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '1rem', maxHeight: '38rem', overflowY: rankedVolunteers.length > 6 ? 'auto' : 'visible', paddingRight: rankedVolunteers.length > 6 ? '0.35rem' : 0 }}>
        {rankedVolunteers.length === 0 ? <p className="text-muted">No volunteers ranked yet.</p> : null}
        {rankedVolunteers.map((volunteer, index) => {
          const score = period === 'weekly'
            ? Number(volunteer.weeklyPoints || 0)
            : period === 'monthly'
              ? Number(volunteer.monthlyPoints || 0)
              : Number(volunteer.rewardPoints || volunteer.impactScore || 0);

          return (
            <div
              key={volunteer.id || volunteer._id || `${volunteer.name || 'volunteer'}-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.1rem',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--glass-border)'
              }}
            >
              <div
                style={{
                  width: '2.7rem',
                  height: '2.7rem',
                  borderRadius: '999px',
                  display: 'grid',
                  placeItems: 'center',
                  background: index === 0 ? 'linear-gradient(135deg, #ffd60a, #ff9500)' : 'rgba(255,255,255,0.08)',
                  color: index === 0 ? '#111' : 'var(--text-primary)',
                  fontWeight: 800
                }}
              >
                {index + 1}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0 }}>{volunteer.name}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{volunteer.skill}</span>
                  <span style={{ padding: '0.24rem 0.6rem', borderRadius: '999px', background: 'rgba(255,209,102,0.12)', color: '#ffd166', fontSize: '0.76rem', fontWeight: 700 }}>
                    {volunteer.rewardTier || 'Bronze Responder'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.35rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock3 size={14} />
                    {volunteer.hoursVolunteered} hrs
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldCheck size={14} />
                    {volunteer.missionsCompleted} missions
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Flame size={14} />
                    {volunteer.currentStreak || 0} week streak
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Award size={14} />
                    {(volunteer.achievements || [volunteer.badge]).slice(0, 1).join(', ') || volunteer.badge}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Trophy size={14} />
                    Reliability {volunteer.reliabilityScore || 0}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {period === 'weekly' ? 'Weekly Points' : period === 'monthly' ? 'Monthly Points' : 'Reward Points'}
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{score}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
