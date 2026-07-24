// Shared account-creation flow for specs that don't test registration itself,
// just need a fresh signed-in (or signed-up) user to act as.
const { waitForCode } = require('./mail');

async function registerAndVerify(page, request, backendUrl, { name, email, password }) {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/verify/);

  const code = await waitForCode(request, backendUrl, email);
  await page.getByLabel('Verification code').fill(code);
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}

async function login(page, { email, password }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/app\/dashboard/);
}

async function registerVerifyAndLogin(page, request, backendUrl, credentials) {
  await registerAndVerify(page, request, backendUrl, credentials);
  await login(page, credentials);
}

/** Deletes the currently signed-in account (teardown), reusing the app's own flow. */
async function deleteAccount(page, password) {
  await page.goto('/app/profile');
  await page.getByRole('button', { name: 'Delete my account' }).click();

  const confirmDialog = page.getByRole('dialog');
  await confirmDialog.getByLabel('Type the confirmation word').fill('DELETE');
  await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

  const reauthDialog = page.getByRole('dialog');
  await reauthDialog.getByLabel('Current password').fill(password);
  await reauthDialog.getByRole('button', { name: 'Delete my account' }).click();
}

module.exports = { registerAndVerify, login, registerVerifyAndLogin, deleteAccount };
