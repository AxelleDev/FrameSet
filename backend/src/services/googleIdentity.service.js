/**
 * Google ID-token verification, shared by sign-in (auth.service) and the
 * re-authentication of critical account actions (user.service). Returns a
 * status object instead of throwing, so each caller maps failures to its own
 * error type.
 */

const { OAuth2Client } = require('google-auth-library');
const { GOOGLE_CLIENT_ID } = require('../config/google.config');

// Lazily built verifier (avoids the construction cost when Google sign-in is
// not configured or never used).
let googleClient = null;
const getGoogleClient = () => {
  if (!googleClient) {
    googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  }
  return googleClient;
};

// Verifies a Google ID token cryptographically against Google's keys and our
// client id. Statuses: 'not_configured', 'missing', 'invalid',
// 'email_not_verified', or 'ok' with the identity fields (googleId is Google's
// stable "sub" identifier).
const verifyGoogleIdToken = async (rawCredential) => {
  if (!GOOGLE_CLIENT_ID) {
    return { status: 'not_configured' };
  }

  const credential = typeof rawCredential === 'string' ? rawCredential.trim() : '';
  if (!credential) {
    return { status: 'missing' };
  }

  let payload;
  try {
    const ticket = await getGoogleClient().verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (error) {
    return { status: 'invalid' };
  }

  const googleId = typeof payload?.sub === 'string' ? payload.sub : '';
  const email = typeof payload?.email === 'string' ? payload.email : '';
  if (!googleId || !email) {
    return { status: 'invalid' };
  }
  if (!payload.email_verified) {
    return { status: 'email_not_verified' };
  }

  return { status: 'ok', googleId, email, name: payload.name };
};

module.exports = { verifyGoogleIdToken };
