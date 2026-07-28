// Privacy Policy (/privacy), linked from the sign-in / sign-up legal notice.
import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      path="/privacy"
      description="What data FrameSet collects, why, and how it is protected."
      lastUpdated="July 28, 2026"
    >
      <section>
        <h2>1. What we collect</h2>
        <p>
          To provide the service, FrameSet stores: your name, your email address, your password (as
          a bcrypt hash — never in clear text), and the content you create (projects, palettes,
          typography and brush specifications). If you sign in with Google, we store your Google
          account identifier and the name and email address Google shares with us; we never see your
          Google password. If you turn on two-factor authentication, we store your authenticator
          secret encrypted (never in clear text) and your recovery codes hashed, the same way
          passwords are.
        </p>
      </section>

      <section>
        <h2>2. What we use it for</h2>
        <p>
          Your data is used solely to operate FrameSet: authenticating you, displaying your
          projects, sending transactional emails (verification codes, password-reset codes and
          security alerts), and generating your exports. We do not sell your data, and we do not use
          it for advertising.
        </p>
      </section>

      <section>
        <h2>3. Cookies</h2>
        <p>
          FrameSet uses first-party cookies only, strictly for authentication and security: an
          access token, a refresh token (both HttpOnly, inaccessible to scripts) and a CSRF
          protection token. There are no advertising or cross-site tracking cookies. A local
          preference also remembers your light/dark theme choice.
        </p>
      </section>

      <section>
        <h2>4. Public sharing</h2>
        <p>
          You may generate a public share link for a project. Anyone with that link can view the
          project&apos;s reference sheet — its colors, typography and brush specifications — without
          an account, along with your display name shown as a &quot;Made by&quot; credit. Your email
          address and account details are never exposed. You can revoke a share link at any time
          from the project; once revoked, the link stops working immediately.
        </p>
      </section>

      <section>
        <h2>5. Third-party services</h2>
        <p>
          A few external services are involved: Google Fonts (to list and preview typefaces you pick
          for your projects) and Google Sign-In (only if you choose to continue with Google, under{' '}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Google&apos;s privacy policy
          </a>
          ). Transactional emails are delivered through our email provider. To keep the service
          reliable, technical error reports (an error message, a request identifier and technical
          context — never your password or the content of your projects) may be processed by our
          error-monitoring provider, Sentry.
        </p>
      </section>

      <section>
        <h2>6. How your data is protected</h2>
        <p>
          Passwords are hashed with bcrypt, one-time codes and recovery codes are stored hashed,
          sessions use HttpOnly cookies with short lifetimes and server-side revocation, and every
          sensitive action (password or email change, new sign-in method, enabling or disabling
          two-factor authentication) triggers a security alert email. You can add an optional second
          authentication factor (a code from an authenticator app) from your profile at any time.
          All traffic is encrypted in transit (HTTPS).
        </p>
      </section>

      <section>
        <h2>7. Retention and deletion</h2>
        <p>
          Your data is kept for as long as your account exists. Deleting a project, a color or a
          standard does not erase it immediately: it is kept in a recoverable trash for 30 days, so
          you can undo an accidental deletion, then permanently purged. Deleting your account from
          your profile page is different — it is immediate and permanently removes your account and
          all associated projects, bypassing the trash. You can also update your name, email and
          password at any time.
        </p>
      </section>

      <section>
        <h2>8. Your rights</h2>
        <p>
          Depending on where you live (e.g. under the GDPR), you may have rights of access,
          rectification, portability and erasure over your personal data. Most of these are
          available directly in the app; for anything else, write to{' '}
          <a href="mailto:axelle.tempier@gmail.com">axelle.tempier@gmail.com</a>.
        </p>
      </section>

      <section>
        <h2>9. Changes to this policy</h2>
        <p>
          We may update this policy from time to time; the &quot;Last updated&quot; date above
          reflects the latest revision. See also the <Link to="/terms">Terms of Service</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
