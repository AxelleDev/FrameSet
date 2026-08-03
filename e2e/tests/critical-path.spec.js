// The one critical journey: register -> verify email -> log in -> create a
// project -> add content -> share it publicly -> export a PDF -> clean up.
// One serial suite, sharing a single page across steps (each depends on the
// state the previous step left behind — a signed-in session, an existing
// project...): https://playwright.dev/docs/test-retries#serial-mode plus the
// "reuse a single page" pattern, since Playwright gives each test() a fresh
// page/context by default even under serial mode.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { BACKEND_URL } = require('../env');
const { waitForCode } = require('./helpers/mail');

test.describe.configure({ mode: 'serial' });

const timestamp = Date.now();
const email = `e2e+${timestamp}@example.com`;
const password = 'Sup3rSecret!';
const name = 'E2E Test User';
const projectName = `E2E Project ${timestamp}`;
const colorName = 'Signal Red';
const colorHex = 'FF3355';

test.describe('critical path: register, verify, project, share, export', () => {
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('registers a new account', async () => {
    await page.goto('/register');
    // Two-step form: identity first, then password.
    await page.getByLabel('Username').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/verify/);
  });

  test('verifies the account with the emailed code', async ({ request }) => {
    await page.goto(`/verify?email=${encodeURIComponent(email)}`);

    const code = await waitForCode(request, BACKEND_URL, email);
    await page.getByLabel('Verification code').fill(code);
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page.getByText(/verified/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('logs in', async () => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('creates a project', async () => {
    await page.goto('/app/dashboard');
    await page.getByRole('button', { name: '+ Create project' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Project name').fill(projectName);
    await dialog.getByRole('button', { name: 'Create project' }).click();

    const projectLink = page.getByRole('button', { name: projectName });
    await expect(projectLink).toBeVisible();
    await projectLink.click();

    await expect(page).toHaveURL(/\/norms$/);
  });

  test('adds a brush standard', async () => {
    // Standards is the project's default landing page; the "Type" field
    // already defaults to Brush, so there's no need to touch it.
    await page.getByRole('button', { name: 'Add' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Brush usage').fill('Line art');
    await dialog.getByLabel('Size (px)').fill('6');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText('Line art')).toBeVisible();
  });

  test('adds a palette color', async () => {
    await page.getByRole('link', { name: 'Palette' }).click();
    await expect(page).toHaveURL(/\/palette$/);

    await page.getByRole('button', { name: 'New color' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Color usage').fill(colorName);
    await dialog.getByLabel('Color', { exact: true }).fill(colorHex);
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText(colorName)).toBeVisible();
  });

  test('creates a public share link and it works while signed out', async ({ browser }) => {
    await page.getByRole('link', { name: 'Export' }).click();
    await expect(page).toHaveURL(/\/export$/);

    await page.getByRole('button', { name: 'Create share link' }).click();
    const shareUrl = await page.getByTestId('share-url').innerText();
    expect(shareUrl).toContain('/s/');

    // Fresh, unauthenticated browser context: proves the page genuinely
    // works logged out, not just via the already-authenticated session.
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(shareUrl);

    await expect(guestPage.getByText(colorName)).toBeVisible();
    await expect(guestPage.getByText('Line art')).toBeVisible();
    await guestContext.close();
  });

  test('the share link serves a real social-preview image and crawler tags', async ({
    request,
  }) => {
    const shareUrl = await page.getByTestId('share-url').innerText();
    const token = shareUrl.split('/s/')[1];

    // The og:image endpoint answers a genuine PNG (magic bytes checked).
    const image = await request.get(`${BACKEND_URL}/api/share/${token}/preview.png`);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');
    const body = await image.body();
    expect(body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    // The crawler-facing embed carries the Open Graph tags.
    const embed = await request.get(`${BACKEND_URL}/api/share/${token}/embed`);
    expect(embed.status()).toBe(200);
    const html = await embed.text();
    expect(html).toContain('property="og:image"');
    expect(html).toContain(`/api/share/${token}/preview.png`);
  });

  test('exports a real PDF file', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download PDF' }).click(),
    ]);

    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    const buffer = fs.readFileSync(filePath);
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test('exports a real JSON file carrying the project content', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download JSON' }).click(),
    ]);

    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    // Valid JSON, and it actually contains the content created above — not an
    // empty shell with the right file extension.
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(data.name).toBe(projectName);
    expect(data.palette.map((color) => color.name)).toContain(colorName);
    expect(data.brushNorms.map((norm) => norm.name)).toContain('Line art');
  });

  test('cleans up: deletes the account', async () => {
    await page.goto('/app/profile');
    await page.getByRole('button', { name: 'Delete my account' }).click();

    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByLabel('Type the confirmation word').fill('DELETE');
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    const reauthDialog = page.getByRole('dialog');
    await reauthDialog.getByLabel('Current password').fill(password);
    await reauthDialog.getByRole('button', { name: 'Delete my account' }).click();

    await expect(page).toHaveURL(/\/login/);
  });
});
