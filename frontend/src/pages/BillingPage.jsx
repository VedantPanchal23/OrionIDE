import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as billingService from '../services/billingService';
import { Spinner } from '../components/ui/primitives';

export default function BillingPage() {
  const [params] = useSearchParams();
  const { refreshMe, user } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const success = params.get('success') === '1';
  const canceled = params.get('canceled') === '1';
  const planParam = params.get('plan');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshMe();
      } catch { /* ignore */ }
      if (cancelled) return;

      if (success) {
        setConfirming(true);
        const startPlan = String(user?.planId || user?.entitlements?.planId || 'free').toLowerCase();
        for (let i = 0; i < 8; i += 1) {
          try {
            const ent = await billingService.getEntitlements();
            await refreshMe();
            const next = String(ent?.planId || '').toLowerCase();
            if (next && next !== 'free' && next !== startPlan) break;
            if (planParam && next === String(planParam).toLowerCase()) break;
          } catch { /* keep polling */ }
          await new Promise((r) => setTimeout(r, 750));
          if (cancelled) return;
        }
        if (!cancelled) setConfirming(false);
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll once on mount / query
  }, [refreshMe, success, planParam]);

  const planName = user?.entitlements?.planName || user?.planId || planParam || 'your plan';

  return (
    <div className="login-page billing-page">
      <div className="billing-card">
        {!ready || confirming ? (
          <>
            <Spinner size={28} />
            <p className="muted" style={{ marginTop: 12 }}>
              {confirming ? 'Confirming plan upgrade…' : 'Loading…'}
            </p>
          </>
        ) : (
          <>
            <h1>Orion Billing</h1>
            {success && (
              <p>
                Upgrade complete
                {planName ? ` — you are on ${planName}` : ''}.
                Welcome back.
              </p>
            )}
            {canceled && (
              <p>Checkout canceled. You can upgrade anytime from Settings.</p>
            )}
            {!success && !canceled && (
              <p>Manage your plan from Settings inside the IDE.</p>
            )}
            <div className="billing-actions">
              <button type="button" className="btn-primary" onClick={() => navigate('/projects')}>
                Open projects
              </button>
              <Link to="/projects" className="muted">Continue</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
