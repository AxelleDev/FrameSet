// Polls the backend's E2E-test-mode-only endpoint (see
// backend/src/routes/testE2E.routes.js) for the last captured email sent to
// a recipient, and extracts the 6-digit verification code from it. The send
// happens asynchronously relative to the API response the frontend awaits,
// so this retries for a short window rather than reading once.
async function waitForCode(
  request,
  backendUrl,
  email,
  { timeoutMs = 10_000, intervalMs = 250 } = {},
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await request.get(`${backendUrl}/api/_test/last-email`, {
      params: { to: email },
      failOnStatusCode: false,
    });

    if (res.ok()) {
      const { text } = await res.json();
      const match = /\b(\d{6})\b/.exec(text || '');
      if (match) return match[1];
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for a verification code sent to ${email}`);
}

module.exports = { waitForCode };
