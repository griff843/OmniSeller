import { test, expect } from '@playwright/test';

test('login primary flow remains usable at mobile width', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  expect((await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))).toBe(true);
});
