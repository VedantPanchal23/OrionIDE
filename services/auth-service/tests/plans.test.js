/**
 * Plans catalog unit test
 */
const { PLANS, getPlan, DEFAULT_PLAN_ID } = require('../../../shared/constants/plans');

describe('plans catalog', () => {
  test('default plan is free', () => {
    expect(DEFAULT_PLAN_ID).toBe('free');
    expect(getPlan('nope').id).toBe('free');
  });

  test('pro unlocks collab; free keeps agents + debugger (OSS same-UI)', () => {
    expect(PLANS.pro.limits.debuggerEnabled).toBe(true);
    expect(PLANS.pro.limits.collabEnabled).toBe(true);
    expect(PLANS.pro.limits.agentsEnabled).toBe(true);
    expect(PLANS.free.limits.debuggerEnabled).toBe(true);
    expect(PLANS.free.limits.agentsEnabled).toBe(true);
    expect(PLANS.free.limits.collabEnabled).toBe(false);
  });
});
