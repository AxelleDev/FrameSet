// Palette file import: a real .gpl (GIMP/Krita) file goes through the "Import
// a palette" picker, its colors land in the palette, and they survive a reload
// (i.e. the import was actually persisted, not just parsed client-side).
const { test, expect } = require('@playwright/test');
const { BACKEND_URL } = require('../env');
const { registerVerifyAndLogin, deleteAccount } = require('./helpers/auth');

test.describe.configure({ mode: 'serial' });

const timestamp = Date.now();
const email = `e2e-import+${timestamp}@example.com`;
const password = 'Sup3rSecret!';
const name = 'E2E Import User';
const projectName = `E2E Import Project ${timestamp}`;

// Minimal but real GIMP palette: header, meta lines, a comment, two colors
// (tab-separated name, as GIMP writes them) and a malformed line the parser
// must skip without failing the import.
const GPL_FILE = [
  'GIMP Palette',
  'Name: E2E Import',
  'Columns: 2',
  '# a comment line',
  '255 87 51\tSunset Orange',
  '51 87 255\tDeep Blue',
  'not a color line',
  '',
].join('\n');

test.describe('palette import from a .gpl file', () => {
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await registerVerifyAndLogin(page, page.request, BACKEND_URL, { name, email, password });

    await page.goto('/app/dashboard');
    await page.getByRole('button', { name: '+ Create project' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Project name').fill(projectName);
    await dialog.getByRole('button', { name: 'Create project' }).click();
    await page.getByRole('button', { name: projectName }).click();
    await page.getByRole('link', { name: 'Palette' }).click();
    await expect(page).toHaveURL(/\/palette$/);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('imports the file through the palette picker', async () => {
    // The visible button opens a hidden file input; set the file on the input
    // directly (accept=".ase,.gpl,.swatches").
    await page.locator('input[type="file"][accept=".ase,.gpl,.swatches"]').setInputFiles({
      name: 'e2e-palette.gpl',
      mimeType: 'text/plain',
      buffer: Buffer.from(GPL_FILE, 'utf8'),
    });

    // A selection dialog previews the parsed colors first: both valid colors
    // are pre-selected, and the malformed line is reported as skipped — not
    // silently dropped, not failing the whole import.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/1 entry in this file could not be read/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Sunset Orange, #FF5733/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Deep Blue, #3357FF/i })).toBeVisible();
    await dialog.getByRole('button', { name: 'Add (2)' }).click();

    await expect(page.getByLabel(/^Color Sunset Orange,/)).toBeVisible();
    await expect(page.getByLabel(/^Color Deep Blue,/)).toBeVisible();
  });

  test('the imported colors survive a reload (they were actually saved)', async () => {
    await page.reload();

    await expect(page.getByLabel(/^Color Sunset Orange,/)).toBeVisible();
    await expect(page.getByLabel(/^Color Deep Blue,/)).toBeVisible();
    // The malformed line was skipped, not imported as a bogus color: exactly
    // the two valid colors are present.
    await expect(page.locator('[aria-label^="Color "]:not([role="group"])')).toHaveCount(2);
  });

  test('cleans up: deletes the account', async () => {
    await deleteAccount(page, password);
    await expect(page).toHaveURL(/\/login/);
  });
});
