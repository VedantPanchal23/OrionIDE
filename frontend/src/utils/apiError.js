/**
 * Human-readable API / entitlement errors for toasts and Output.
 */
export function formatApiError(err, fallback = 'Request failed') {
  const data = err?.response?.data?.error || err?.response?.data || {};
  const code = data.code || err?.code;
  const message = data.message || err?.message || fallback;
  const details = data.details;

  switch (code) {
    case 'PLAN_FEATURE_LOCKED':
      return details?.reason
        ? `Feature unavailable (${details.reason}). ${message}`
        : message || 'This feature is not available on your plan.';
    case 'PLAN_LIMIT_EXECUTE':
      return `Execution limit reached${details?.limit != null ? ` (${details.count}/${details.limit})` : ''}. Try again shortly.`;
    case 'PLAN_LIMIT_AGENT':
      return `Agent pipeline limit reached${details?.limit != null ? ` (${details.count}/${details.limit} today)` : ''}.`;
    case 'ENTITLEMENTS_UNAVAILABLE':
      return 'Billing entitlements temporarily unavailable. Retry in a moment.';
    default:
      return message || fallback;
  }
}

export function isPlanError(err) {
  const code = err?.response?.data?.error?.code || err?.response?.data?.code;
  return typeof code === 'string' && (
    code.startsWith('PLAN_') || code === 'ENTITLEMENTS_UNAVAILABLE'
  );
}
