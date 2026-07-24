// Deleting a project soft-deletes it (moves it to the trash, restorable) —
// verifies the full round trip: create, delete, see it in the trash, restore
// it, see it back in the main grid.
const { test, expect } = require('@playwright/test');
const { BACKEND_URL } = require('../env');
const { registerVerifyAndLogin, deleteAccount } = require('./helpers/auth');

test.describe.configure({ mode: 'serial' });

const timestamp = Date.now();
const email = `e2e-trash+${timestamp}@example.com`;
const password = 'Sup3rSecret!';
const name = 'E2E Trash User';
const projectName = `E2E Trash Project ${timestamp}`;

test.describe('project trash and restore', () => {
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await registerVerifyAndLogin(page, page.request, BACKEND_URL, { name, email, password });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('creates a project to delete', async () => {
    await page.goto('/app/dashboard');
    await page.getByRole('button', { name: '+ Create project' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Project name').fill(projectName);
    await dialog.getByRole('button', { name: 'Create project' }).click();

    await expect(page.getByRole('button', { name: projectName })).toBeVisible();
  });

  test('moves the project to the trash', async () => {
    await page.getByRole('button', { name: 'Delete project' }).click();
    await page.getByRole('button', { name: 'Move to trash' }).click();

    await expect(page.getByRole('button', { name: projectName })).not.toBeVisible();
  });

  test('shows it in the trash and restores it', async () => {
    await expect(page.getByRole('heading', { name: /^Trash/ })).toBeVisible();
    await expect(page.getByText(projectName)).toBeVisible();

    await page.getByRole('button', { name: 'Restore' }).click();

    await expect(page.getByRole('button', { name: projectName })).toBeVisible();
  });

  test('cleans up: deletes the account', async () => {
    await deleteAccount(page, password);
    await expect(page).toHaveURL(/\/login/);
  });
});
