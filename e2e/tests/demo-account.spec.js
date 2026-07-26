// "Try without an account": logging into the shared demo account lands on a
// dashboard pre-populated with real project data. Content edits (colors,
// standards...) are simulated purely client-side (ProjectContext.jsx) and
// never reach the API, so the UI feels fully interactive but a reload always
// reverts to the real seeded data. Account-level actions (Profile) stay
// hidden/disabled — those really are blocked server-side (authenticateToken.js).
const { test, expect } = require('@playwright/test');

test.describe('read-only demo account', () => {
  test('logs in via "Try the demo" and shows the seeded project', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the demo — no account needed' }).click();

    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(
      page.getByText("You're exploring a read-only demo — changes won't be saved."),
    ).toBeVisible();

    const demoProject = page.getByRole('button', { name: /Alyse \| Twitch/ });
    await expect(demoProject).toBeVisible();
  });

  test('editing the palette feels real (no error) but never persists', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the demo — no account needed' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    await page
      .getByRole('button', { name: /Alyse \| Twitch/ })
      .click({ position: { x: 10, y: 10 } });
    await page.getByRole('link', { name: 'Palette' }).click();
    await expect(page).toHaveURL(/\/palette$/);

    await expect(page.getByText('Eye Reflection')).toBeVisible();
    expect(await page.locator('[aria-label^="Color "]:not([role="group"])').count()).toBe(7);

    // Add a color: it should appear immediately, with no error toast — the
    // mutation never leaves the browser (see ProjectContext.jsx's isDemo branches).
    await page.getByRole('button', { name: 'New color' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Color name').fill('Session Only Color');
    await dialog.getByLabel('Color', { exact: true }).fill('123456');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText('Session Only Color')).toBeVisible();
    expect(await page.locator('[aria-label^="Color "]:not([role="group"])').count()).toBe(8);

    // Reloading re-fetches the real (untouched) seeded data: the simulated
    // add never reached the server, so it's gone and the original 7 remain.
    await page.reload();
    await expect(page.getByText('Eye Reflection')).toBeVisible();
    expect(await page.locator('[aria-label^="Color "]:not([role="group"])').count()).toBe(7);
    await expect(page.getByText('Session Only Color')).not.toBeVisible();
  });

  test('account settings are disabled, not just erroring', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the demo — no account needed' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    await page.goto('/app/profile');

    await expect(page.getByRole('button', { name: 'Edit' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete my account' })).not.toBeVisible();
    await expect(page.getByText("Account deletion isn't available in the demo.")).toBeVisible();
  });

  test('"Create a free account" signs out of the demo first', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Try the demo — no account needed' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);

    await page.getByRole('button', { name: 'Create a free account' }).click();
    await expect(page).toHaveURL(/\/register/);

    // The demo session is really gone, not just hidden: visiting a protected
    // route now bounces to /login instead of showing the dashboard again.
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
