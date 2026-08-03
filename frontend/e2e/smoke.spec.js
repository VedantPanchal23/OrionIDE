import { test, expect } from '@playwright/test';

test.describe('Orion IDE smoke', () => {
  test('login page is brand-first and offers Google sign-in', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Orion IDE')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('auth success without code redirects to login', async ({ page }) => {
    await page.goto('/auth/success');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to IDE redirects to login', async ({ page }) => {
    await page.goto('/ide');
    await expect(page).toHaveURL(/\/login/);
  });
});
