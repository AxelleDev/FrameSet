// Two-factor authentication journey: enroll from the profile (QR/manual
// secret -> live code -> recovery codes), sign in with an authenticator code,
// fall back to a single-use recovery code, then disable 2FA and confirm the
// plain password sign-in is restored. Codes are computed for real from the
// enrollment secret (see helpers/totp.js) — nothing is mocked.
const { test, expect } = require('@playwright/test');
const { BACKEND_URL } = require('../env');
const { registerVerifyAndLogin, deleteAccount } = require('./helpers/auth');
const { generateTotpCode } = require('./helpers/totp');

test.describe.configure({ mode: 'serial' });

const timestamp = Date.now();
const email = `e2e-totp+${timestamp}@example.com`;
const password = 'Sup3rSecret!';
const name = 'E2E TOTP User';

async function signOut(page) {
  await page.goto('/app/profile');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/);
}

async function submitCredentials(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('two-factor authentication', () => {
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Page} */
  let page;
  /** The Base32 secret revealed during enrollment; codes are derived from it. */
  let secret;
  /** The one-time recovery codes shown exactly once after enrollment. */
  let recoveryCodes;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await registerVerifyAndLogin(page, page.request, BACKEND_URL, { name, email, password });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('enables 2FA from the profile and shows the recovery codes once', async () => {
    await page.goto('/app/profile');
    await page.getByRole('button', { name: 'Enable', exact: true }).click();

    // Grab the manual-entry secret (the QR encodes the same one).
    const secretLocator = page.getByText(/^[A-Z2-7]{16,}$/);
    await expect(secretLocator).toBeVisible();
    secret = (await secretLocator.textContent()).trim();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Verification code').fill(generateTotpCode(secret));
    await dialog.getByRole('button', { name: 'Enable', exact: true }).click();

    // Recovery codes appear exactly once — capture them for the later tests.
    await expect(page.getByText(/won't be able to see these again/i)).toBeVisible();
    recoveryCodes = await dialog.locator('li', { hasText: /^[0-9A-F]{5}-/ }).allTextContents();
    expect(recoveryCodes.length).toBeGreaterThan(0);
    await dialog.getByRole('button', { name: /saved my recovery codes/i }).click();

    await expect(page.getByText('Enabled', { exact: true })).toBeVisible();
    await expect(page.getByText(`${recoveryCodes.length} recovery codes remaining.`)).toBeVisible();
  });

  test('signing in now demands the authenticator code, and rejects a wrong one', async () => {
    await signOut(page);
    await submitCredentials(page);

    await expect(page.getByText('Two-factor authentication')).toBeVisible();
    await page.getByLabel('Verification code').fill('000000');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText(/incorrect code/i)).toBeVisible();

    // The enrollment already consumed the current 30s step (anti-replay), so
    // use the next step's code rather than sleeping until it comes around.
    await page
      .getByLabel('Verification code')
      .fill(generateTotpCode(secret, { at: Date.now() + 30_000 }));
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('a recovery code signs in as a fallback, and is single-use', async () => {
    await signOut(page);
    await submitCredentials(page);

    await page.getByRole('button', { name: /use a recovery code instead/i }).click();
    await page.getByLabel('Recovery code').fill(recoveryCodes[0]);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    // One code spent: the profile's remaining count reflects it.
    await page.goto('/app/profile');
    await expect(
      page.getByText(`${recoveryCodes.length - 1} recovery codes remaining.`),
    ).toBeVisible();

    // The same code is dead now; a fresh one still works.
    await signOut(page);
    await submitCredentials(page);
    await page.getByRole('button', { name: /use a recovery code instead/i }).click();
    await page.getByLabel('Recovery code').fill(recoveryCodes[0]);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText(/incorrect code/i)).toBeVisible();

    await page.getByLabel('Recovery code').fill(recoveryCodes[1]);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('disabling 2FA restores the plain password sign-in', async () => {
    await page.goto('/app/profile');
    await page.getByRole('button', { name: 'Disable', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Current password').fill(password);
    await dialog.getByRole('button', { name: 'Disable 2FA' }).click();

    await expect(page.getByText('Disabled', { exact: true })).toBeVisible();

    await signOut(page);
    await submitCredentials(page);
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('cleans up: deletes the account', async () => {
    await deleteAccount(page, password);
    await expect(page).toHaveURL(/\/login/);
  });
});
