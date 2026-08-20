import api from './api';

export async function getPlans() {
  const res = await api.get('/billing/plans');
  return res.data?.data;
}

export async function getEntitlements() {
  const res = await api.get('/billing/entitlements');
  return res.data?.data;
}

export async function startCheckout(planId = 'pro') {
  const res = await api.post('/billing/checkout', { planId });
  return res.data?.data;
}
