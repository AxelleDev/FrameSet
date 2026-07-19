/**
 * Google Sign-In config. Deliberately optional: when GOOGLE_CLIENT_ID is unset
 * the feature is disabled (the endpoint answers 503 and the frontend hides the
 * button), so a deployment without Google configured still works fully.
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

module.exports = { GOOGLE_CLIENT_ID };
