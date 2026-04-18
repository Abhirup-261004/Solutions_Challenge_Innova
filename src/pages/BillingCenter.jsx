import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, Receipt, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { billingPlanDefinitions, useAuth } from '../contexts/AuthContext';
import { getJson, patchJson, postJson } from '../utils/api';

const emptyBilling = {
  planId: 'community',
  planName: 'Community',
  status: 'active',
  provider: 'mock',
  billingCycle: 'monthly',
  amount: 0,
  currency: 'USD',
  renewalDate: null,
  customerId: null,
  subscriptionId: null,
  checkoutHistory: [],
  paymentHistory: []
};

export default function BillingCenter() {
  const { currentUser, getToken, updateBilling } = useAuth();
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(emptyBilling);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Loading billing center...');
  const [checkoutState, setCheckoutState] = useState({ planId: null, provider: 'mock', checkoutId: null });
  const [confirmingPlanId, setConfirmingPlanId] = useState(null);

  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === subscription.planId) || null,
    [plans, subscription.planId]
  );

  useEffect(() => {
    const fetchBilling = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const [plansData, subscriptionData] = await Promise.all([
          getJson('/api/billing/plans'),
          getJson('/api/billing/subscription', { token })
        ]);

        setPlans(Array.isArray(plansData.plans) ? plansData.plans : []);
        setSubscription(subscriptionData.subscription || emptyBilling);
        setMessage('Billing center is ready. You can review plans, activate mock checkout, and inspect payment history.');
      } catch (error) {
        console.error(error);
        setMessage(`Billing data is unavailable right now. ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchBilling();
  }, [getToken]);

  const handleStartCheckout = async (planId, provider = 'mock') => {
    setCheckoutState({ planId, provider, checkoutId: null });
    try {
      const token = await getToken();
      const data = await postJson('/api/billing/checkout', { planId, provider }, { token });
      setCheckoutState({
        planId,
        provider,
        checkoutId: data.checkout?.id || null
      });
      setMessage(data.message || 'Checkout started.');
    } catch (error) {
      console.error(error);
      setMessage(`Unable to start checkout. ${error.message}`);
      setCheckoutState({ planId: null, provider: 'mock', checkoutId: null });
    }
  };

  const handleConfirmCheckout = async (planId, provider = 'mock') => {
    setConfirmingPlanId(planId);
    try {
      const token = await getToken();
      const data = await patchJson('/api/billing/checkout/confirm', { planId, provider }, { token });
      setSubscription(data.subscription || emptyBilling);
      await updateBilling(data.subscription || emptyBilling);
      setMessage(`${data.plan?.name || 'Selected plan'} is now active on this account.`);
      setCheckoutState({ planId: null, provider: 'mock', checkoutId: null });
    } catch (error) {
      console.error(error);
      setMessage(`Unable to confirm checkout. ${error.message}`);
    } finally {
      setConfirmingPlanId(null);
    }
  };

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '2rem' }}>
      <section className="glass-panel" style={{ padding: 'clamp(1.6rem, 4vw, 2.3rem)', background: 'linear-gradient(140deg, rgba(0,198,255,0.08), rgba(8,12,20,0.92) 48%, rgba(255,149,0,0.08))' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(260px, 0.9fr)', gap: '1.25rem', alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', width: 'fit-content', padding: '0.45rem 0.9rem', borderRadius: '999px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)' }}>
              <CreditCard size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>Monetization + billing architecture</span>
            </div>
            <div>
              <h1 className="text-gradient">Billing Center</h1>
              <p className="text-muted" style={{ marginTop: '0.6rem', maxWidth: '70ch' }}>
                This page turns the platform into a deployable SaaS product. It manages subscription tiers, mock checkout, and payment history while staying ready for live Stripe or Razorpay integration later.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
              <Link to="/" className="btn-primary">Open Landing Page</Link>
            </div>
            <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>{message}</p>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', display: 'grid', gap: '0.7rem' }}>
            <p className="text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current subscription</p>
            <h3 style={{ margin: 0 }}>{subscription.planName || currentPlan?.name || 'Community'}</h3>
            <p className="text-muted" style={{ fontSize: '0.86rem' }}>
              {subscription.status === 'active' ? 'Active' : subscription.status || 'Pending'} via {subscription.provider || 'mock'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem' }}>
              <div className="glass-panel" style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount</p>
                <p style={{ fontWeight: 700, marginTop: '0.15rem' }}>
                  {subscription.amount ? `${subscription.currency || 'USD'} ${subscription.amount}` : 'Free'}
                </p>
              </div>
              <div className="glass-panel" style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Renewal</p>
                <p style={{ fontWeight: 700, marginTop: '0.15rem' }}>{formatDate(subscription.renewalDate)}</p>
              </div>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>
              Signed in as {currentUser?.email || 'unknown'}.
            </p>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {plans.map((plan) => {
          const isCurrent = subscription.planId === plan.id;
          const isCheckoutReady = checkoutState.planId === plan.id && checkoutState.provider === 'mock';
          const theme = billingPlanDefinitions[plan.id] || billingPlanDefinitions.community;

          return (
            <div
              key={plan.id}
              className="glass-panel"
              style={{
                padding: '1.35rem',
                display: 'grid',
                gap: '0.95rem',
                background: plan.recommended
                  ? 'linear-gradient(180deg, rgba(0,198,255,0.1), rgba(255,255,255,0.025))'
                  : 'rgba(255,255,255,0.025)',
                border: isCurrent ? `1px solid ${theme.accent}` : '1px solid var(--glass-border)',
                position: 'relative'
              }}
            >
              {plan.recommended ? (
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.3rem 0.7rem', borderRadius: '999px', background: 'rgba(0,198,255,0.14)', color: 'var(--accent-cyan)', fontSize: '0.74rem', fontWeight: 700 }}>
                  Recommended
                </div>
              ) : null}
              {isCurrent ? (
                <div style={{ position: 'absolute', top: '1rem', left: '1rem', padding: '0.3rem 0.7rem', borderRadius: '999px', background: 'rgba(0,255,136,0.14)', color: 'var(--accent-green)', fontSize: '0.74rem', fontWeight: 700 }}>
                  Active
                </div>
              ) : null}

              <div style={{ paddingTop: isCurrent ? '1.8rem' : 0 }}>
                <p style={{ fontSize: '0.78rem', color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{plan.name}</p>
                <h3 style={{ fontSize: '2rem', marginTop: '0.35rem' }}>{plan.priceLabel}</h3>
                <p className="text-muted" style={{ fontSize: '0.86rem', marginTop: '0.35rem' }}>{plan.audience}</p>
              </div>

              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {plan.features.map((feature) => (
                  <div key={feature} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.65rem', alignItems: 'start' }}>
                    <CheckCircle2 size={15} color={theme.accent} />
                    <p className="text-muted" style={{ fontSize: '0.84rem' }}>{feature}</p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <button
                  type="button"
                  className={isCurrent ? 'btn-secondary' : 'btn-primary'}
                  disabled={isCurrent || checkoutState.planId === plan.id || confirmingPlanId === plan.id}
                  onClick={() => handleStartCheckout(plan.id, 'mock')}
                >
                  {isCurrent ? 'Current Plan' : checkoutState.planId === plan.id ? 'Checkout Ready' : 'Start Mock Checkout'}
                </button>
                {!isCurrent && isCheckoutReady ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={confirmingPlanId === plan.id}
                    onClick={() => handleConfirmCheckout(plan.id, 'mock')}
                  >
                    {confirmingPlanId === plan.id ? 'Activating...' : 'Confirm Mock Payment'}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(320px, 1.1fr)', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Monetization Features</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              The billing architecture is already structured for ethical humanitarian SaaS pricing rather than paywalling essential aid workflows.
            </p>
          </div>
          {[
            { title: 'Subscription tiers', body: 'Community, Pro, and Enterprise plans are now represented in code and account state.', icon: <ShieldCheck size={16} color="var(--accent-cyan)" /> },
            { title: 'Mock checkout', body: 'You can demo payment activation today while keeping the backend ready for a real provider later.', icon: <CreditCard size={16} color="var(--accent-orange)" /> },
            { title: 'Payment history', body: 'Each confirmation produces a stored payment record for billing transparency and future invoicing.', icon: <Receipt size={16} color="var(--accent-green)" /> },
            { title: 'Provider-ready path', body: 'Stripe and Razorpay are both scaffold-friendly through the provider field on checkout and subscription records.', icon: <Sparkles size={16} color="var(--accent-purple)" /> }
          ].map((item) => (
            <div key={item.title} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem' }}>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center' }}>{item.icon}</div>
              <div>
                <p style={{ fontWeight: 700 }}>{item.title}</p>
                <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.18rem' }}>{item.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <h3>Payment History</h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', marginTop: '0.22rem' }}>
              Your latest subscription payments and mock transactions appear here. This can later become invoices, receipts, and webhook-confirmed billing events.
            </p>
          </div>
          {(subscription.paymentHistory || []).length ? (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {subscription.paymentHistory.map((payment) => (
                <div key={payment.id} className="glass-panel" style={{ padding: '0.95rem 1rem', background: 'rgba(255,255,255,0.025)', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{payment.planName}</p>
                    <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.16rem' }}>
                      {payment.provider} • {payment.status}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 700 }}>{payment.amount ? `${payment.currency} ${payment.amount}` : 'Free'}</p>
                    <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.16rem' }}>{formatDate(payment.paidAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)' }}>
              <p style={{ fontWeight: 700 }}>No payments yet.</p>
              <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                Activate a paid plan with mock checkout to populate payment history immediately.
              </p>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.025)', display: 'grid', gap: '0.55rem' }}>
            <p style={{ fontWeight: 700 }}>Live-payment upgrade path</p>
            <p className="text-muted" style={{ fontSize: '0.82rem' }}>
              Replace mock checkout with real Stripe or Razorpay session creation, then use provider webhooks to confirm the subscription instead of the current demo confirm button.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--accent-cyan)', fontSize: '0.82rem' }}>
              <ArrowRight size={15} />
              Backend already stores provider, customer, subscription, checkout, and payment metadata.
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="glass-panel" style={{ padding: '1.2rem' }}>
          <p className="text-muted">Refreshing billing data...</p>
        </div>
      ) : null}
    </div>
  );
}

function formatDate(value) {
  if (!value) return 'Not scheduled';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not scheduled';
  return parsed.toLocaleDateString();
}
