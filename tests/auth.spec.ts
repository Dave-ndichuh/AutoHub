import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('should load the login page', async ({ page }) => {
    await page.goto('/login');
    // Assuming there is a heading or title indicating it's a login page
    await expect(page).toHaveTitle(/Login/i);
    // Check for email and password inputs
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword123');
    await page.locator('button[type="submit"]').click();
    
    // Check for an error message or toast (adjust selector based on actual implementation)
    await expect(page.getByText(/invalid/i).or(page.getByText(/error/i))).toBeVisible();
  });
});
