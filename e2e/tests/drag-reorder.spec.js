// Drag-and-drop reorder of palette colors, and that the new order survives a
// reload (i.e. it's actually persisted server-side, not just a client-side
// optimistic reorder that never got saved).
const { test, expect } = require('@playwright/test');
const { BACKEND_URL } = require('../env');
const { registerVerifyAndLogin, deleteAccount } = require('./helpers/auth');

test.describe.configure({ mode: 'serial' });

const timestamp = Date.now();
const email = `e2e-reorder+${timestamp}@example.com`;
const password = 'Sup3rSecret!';
const name = 'E2E Reorder User';
const projectName = `E2E Reorder Project ${timestamp}`;

const colorTileNames = async (page) =>
  // Exclude the format-toggle group (aria-label "Color display format") so only
  // the color swatches are counted.
  page.locator('[aria-label^="Color "]:not([role="group"])').evaluateAll((nodes) =>
    nodes.map((node) => {
      const match = /^Color (.+?), #/.exec(node.getAttribute('aria-label') || '');
      return match ? match[1] : null;
    }),
  );

test.describe('drag-and-drop reorders the palette and it persists', () => {
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

  test('adds two colors', async () => {
    for (const [colorName, hex] of [
      ['Alpha Red', 'FF0000'],
      ['Beta Blue', '0000FF'],
    ]) {
      await page.getByRole('button', { name: 'New color' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Color usage').fill(colorName);
      await dialog.getByLabel('Color', { exact: true }).fill(hex);
      await dialog.getByRole('button', { name: 'Add' }).click();
      await expect(page.getByText(colorName)).toBeVisible();
    }

    expect(await colorTileNames(page)).toEqual(['Alpha Red', 'Beta Blue']);
  });

  test('dragging the first color onto the second swaps their order', async () => {
    const alpha = page.getByLabel(/^Color Alpha Red,/);
    const beta = page.getByLabel(/^Color Beta Blue,/);

    // Native HTML5 drag-and-drop can fire more than one drop-like event
    // during a single simulated drag, each resetting the reorder's 200ms
    // save debounce (see ProjectPalette.jsx) — so rather than race a single
    // "the next /palette POST" response (which could be an intermediate one,
    // superseded a moment later by the real final save), just wait past the
    // debounce with a comfortable margin once the UI shows the final order.
    await alpha.dragTo(beta);
    await expect.poll(() => colorTileNames(page)).toEqual(['Beta Blue', 'Alpha Red']);
    await page.waitForTimeout(1000);
  });

  test('the new order survives a reload (it was actually saved)', async () => {
    await page.reload();

    // Reload starts a fresh fetch of the project; wait for the colors to
    // actually be back on screen before reading their order.
    await expect(page.getByText('Beta Blue')).toBeVisible();
    await expect(page.getByText('Alpha Red')).toBeVisible();

    expect(await colorTileNames(page)).toEqual(['Beta Blue', 'Alpha Red']);
  });

  test('cleans up: deletes the account', async () => {
    await deleteAccount(page, password);
    await expect(page).toHaveURL(/\/login/);
  });
});
