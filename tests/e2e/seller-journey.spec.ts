import { test, expect, BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function signIn(context: BrowserContext, email: string) {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Name').fill(email.split('@')[0]);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
}

test('protected routes, two sellers, persistence, photos, accessibility, and logout', async ({ browser }) => {
  const anonymous = await browser.newPage();
  await anonymous.goto('/inventory');
  await expect(anonymous).toHaveURL(/\/login/);
  const malformed = await browser.newContext();
  await malformed.addCookies([{ name: 'authjs.session-token', value: 'malformed.jwt.value', domain: '127.0.0.1', path: '/', secure: false, expires: Math.floor(Date.now() / 1000) + 60 }]);
  const malformedPage = await malformed.newPage();
  await malformedPage.goto('/inventory');
  await expect(malformedPage).toHaveURL(/\/login/);
  await malformed.close();

  const sellerA = await browser.newContext();
  const sellerB = await browser.newContext();
  const pageA = await signIn(sellerA, 'playwright-a@local.omniseller');
  const pageB = await signIn(sellerB, 'playwright-b@local.omniseller');
  const sku = `PW-A-${Date.now()}`;
  const created = await sellerA.request.post('/api/inventory', { data: { sku, title: 'Playwright camera' } });
  expect(created.status()).toBe(201);
  const item = await created.json() as { id: string };

  expect((await sellerA.request.get(`/api/inventory/${item.id}`)).status()).toBe(200);
  expect((await sellerB.request.get(`/api/inventory/${item.id}`)).status()).toBe(404);
  expect((await sellerB.request.patch(`/api/inventory/${item.id}`, { data: { title: 'stolen' } })).status()).toBe(404);

  const invalid = await sellerA.request.patch(`/api/inventory/${item.id}`, { data: { title: 'x'.repeat(250) } });
  expect(invalid.status()).toBe(400);
  const repaired = await sellerA.request.patch(`/api/inventory/${item.id}`, { data: { title: 'Recovered camera', condition: 'Used', category: '31388', description: 'Manual description' } });
  expect(repaired.status()).toBe(200);

  const reservation = await sellerA.request.post(`/api/inventory/${item.id}/photos/upload-request`, { data: { files: [{ fileName: 'pixel.png', contentType: 'image/png', sizeBytes: 68 }] } });
  expect(reservation.status()).toBe(200);
  const upload = (await reservation.json()).uploads[0];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  expect((await sellerA.request.put(upload.signedUploadUrl, { headers: { 'content-type': 'image/png' }, data: png })).status()).toBe(200);
  expect((await sellerA.request.post(`/api/inventory/${item.id}/photos/${upload.id}/complete`, { data: { width: 1, height: 1 } })).status()).toBe(201);
  const draft = await sellerA.request.patch(`/api/listings/${item.id}/draft`, { data: { title: 'Manual eBay title', description: 'Seller-authored description', category: '31388', priceCents: 4250, itemSpecifics: { Brand: 'Manual' } } });
  expect(draft.status()).toBe(200);
  expect((await sellerA.request.post(`/api/listings/${item.id}/ai`)).status()).toBe(503);
  expect((await sellerA.request.post(`/api/listings/${item.id}/publish`)).status()).toBe(503);

  await pageA.goto(`/inventory/${item.id}`);
  await expect(pageA.getByText('Recovered camera', { exact: true }).first()).toBeVisible();
  await expect(pageA.locator('img').first()).toBeVisible();
  const results = await new AxeBuilder({ page: pageA }).analyze();
  expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);

  await pageA.reload();
  await expect(pageA.getByText('Recovered camera', { exact: true }).first()).toBeVisible();
  await pageA.getByRole('button', { name: 'Sign out' }).click();
  await expect(pageA).toHaveURL(/\/login/);
  await pageA.goto('/inventory');
  await expect(pageA).toHaveURL(/\/login/);

  await pageB.goto('/inventory');
  await expect(pageB.getByText(sku)).toHaveCount(0);
  await sellerA.close();
  await sellerB.close();
});
