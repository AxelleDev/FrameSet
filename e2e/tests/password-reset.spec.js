// Forgot-password -> reset code by email -> new password -> log in with it.
const { test, expect } = require('@playwright/test');
const { BACKEND_URL } = require('../env');
const { waitForCode } = require('./helpers/mail');
const { registerAndVerify, login, deleteAccount } = require('./helpers/auth');

test.describe.configure({ mode: 'serial' });

const timestamp = Date.now();
const email = `e2e-reset+${timestamp}@example.com`;
const originalPassword = 'Sup3rSecret!';
const newPassword = 'EvenM0reSecret!';
const name = 'E2E Reset User';

test.describe('password reset', () => {
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await registerAndVerify(page, page.request, BACKEND_URL, {
      name,
      email,
      password: originalPassword,
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('requests a reset code', async () => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);

    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page.getByLabel('Reset code')).toBeVisible();
  });

  test('resets the password with the emailed code', async () => {
    const code = await waitForCode(page.request, BACKEND_URL, email);

    await page.getByLabel('Reset code').fill(code);
    await page.getByLabel('New password').fill(newPassword);
    await page.getByLabel('Confirm password').fill(newPassword);
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('the old password no longer works, the new one does', async () => {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(originalPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();

    await page.getByLabel('Password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('cleans up: deletes the account', async () => {
    await deleteAccount(page, newPassword);
    await expect(page).toHaveURL(/\/login/);
  });
});
