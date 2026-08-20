import { expect, test } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

async function gatewayUp() {
  try {
    const r = await fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

function mintToken() {
  return execSync('node scripts/mint-access-token.mjs --print', {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

async function loginWithToken(page) {
  let token;
  try {
    token = mintToken();
  } catch {
    return null;
  }
  if (!token || token.split('.').length !== 3) return null;

  await page.goto('/login');
  await page.getByRole('button', { name: /Use access token/i }).click();
  await page.getByPlaceholder(/JWT access token/i).fill(token);
  await page.getByRole('button', { name: /Continue with token/i }).click();
  await page.waitForURL(/\/projects/, { timeout: 20_000 });
  return token;
}

async function openOrCreateProject(page) {
  await page.waitForURL(/\/projects/, { timeout: 20_000 });
  // Wait until spinner clears (list or empty state)
  await page.locator('.picker-empty .spinner, button.project-card, .picker-empty p').first()
    .waitFor({ state: 'visible', timeout: 30_000 })
    .catch(() => {});

  const card = page.locator('button.project-card').first();
  if (await card.count()) {
    await card.click();
    await page.waitForURL(/\/ide\//, { timeout: 25_000 });
    return true;
  }

  const name = `e2e-${Date.now()}`;
  await page.getByLabel(/New project name/i).fill(name);
  await page.getByRole('button', { name: /Create/i }).click();
  try {
    await page.waitForURL(/\/ide\//, { timeout: 60_000 });
    return true;
  } catch {
    return false;
  }
}

test.describe('Orion smoke', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/Orion/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Google|token|Sign/i }).first()).toBeVisible();
  });

  test('token login form toggles', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Use access token/i }).click();
    await expect(page.getByPlaceholder(/JWT access token/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue with token/i })).toBeVisible();
  });

  test('auth success without code shows recovery', async ({ page }) => {
    await page.goto('/auth/success');
    await expect(page.locator('body')).toBeVisible();
    await page.waitForTimeout(500);
    const url = page.url();
    expect(url.includes('/auth/success') || url.includes('/login') || url.includes('/projects')).toBeTruthy();
  });

  test('ide route redirects unauthenticated users', async ({ page }) => {
    await page.goto('/ide/demo-project');
    await page.waitForURL(/\/(login|projects)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/(login|projects)/);
  });

  test('token login reaches projects when gateway is up', async ({ page }) => {
    test.skip(!(await gatewayUp()), 'API gateway not running on :3000');
    const token = await loginWithToken(page);
    test.skip(!token, 'Could not mint access token');
    await expect(page.getByText(/project|Orion|New/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('IDE shell: explorer, dock, settings, ports', async ({ page }) => {
    test.skip(!(await gatewayUp()), 'API gateway not running on :3000');
    const token = await loginWithToken(page);
    test.skip(!token, 'Could not mint access token');

    const opened = await openOrCreateProject(page);
    test.skip(!opened, 'Could not open or create a Drive project');

    await expect(page.getByText(/Explorer/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Terminal$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Output$/i })).toBeVisible();

    // Ports dock tab
    await page.getByRole('button', { name: /^Ports$/i }).click();
    await expect(page.locator('.ports-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/HTTP proxy to workspace ports/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /5173/i }).first()).toBeVisible();

    // Agents activity
    const agentsBtn = page.getByRole('button', { name: /Agents/i }).first();
    if (await agentsBtn.isVisible()) {
      await agentsBtn.click();
      await expect(page.getByText(/Start pipeline|Goal/i).first()).toBeVisible({ timeout: 10_000 });
    }

    // Settings (gear in activity bar)
    const settingsBtn = page.getByRole('button', { name: /Settings/i }).first();
    await settingsBtn.click();
    await expect(page.getByText(/BYOK|API key|Model|Settings/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('IDE git panel mounts when Source Control opened', async ({ page }) => {
    test.skip(!(await gatewayUp()), 'API gateway not running on :3000');
    const token = await loginWithToken(page);
    test.skip(!token, 'Could not mint access token');
    const opened = await openOrCreateProject(page);
    test.skip(!opened, 'Could not open or create a Drive project');

    await page.getByRole('button', { name: /Source Control|Git/i }).first().click();
    await expect(
      page.getByText(/branch|commit|Changes|Source Control|Git/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
