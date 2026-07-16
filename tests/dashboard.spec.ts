import { test, expect } from '@playwright/test';

test.describe('Dashboard and Navigation', () => {
  // We use a mock or depend on the dev server being up, 
  // but if the dashboard requires authentication, this test might redirect.
  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    // Verify it redirects to login or auth page
    await expect(page).toHaveURL(/\/login|\/auth/);
  });
});
