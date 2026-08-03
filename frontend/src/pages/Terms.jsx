// Terms of Service (/terms), linked from the sign-in / sign-up legal notice.
import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      path="/terms"
      description="The terms that govern your use of FrameSet."
      lastUpdated="August 3, 2026"
    >
      <section>
        <h2>1. About FrameSet</h2>
        <p>
          FrameSet is a web application that lets illustrators and creatives centralize the graphic
          references of their projects — color palettes, typography and brush specifications — and
          export them as reference sheets. By creating an account or using FrameSet, you agree to
          these terms. A read-only demo account is also available to explore FrameSet without
          registering: its content is shared between all visitors, nothing you do in it is saved,
          and it may be reset at any time.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <p>
          You can create an account with an email address and password, or by continuing with
          Google. You are responsible for keeping your credentials confidential and for the activity
          that happens under your account. You must provide accurate information and be legally able
          to enter into this agreement. You may optionally enable two-factor authentication for
          extra security; if you do, you are responsible for keeping your recovery codes safe — they
          are the only way back into your account if you lose access to your authenticator app. You
          can regenerate a fresh set of recovery codes from your profile at any time; the previous
          ones stop working immediately.
        </p>
      </section>

      <section>
        <h2>3. Your content</h2>
        <p>
          The projects, palettes and specifications you create remain yours. FrameSet claims no
          ownership over your content and only stores and processes it to provide the service — for
          example to display your projects and generate your exports (PDF reference sheets, JSON
          data or palette files for your drawing app).
        </p>
      </section>

      <section>
        <h2>4. Public sharing</h2>
        <p>
          FrameSet lets you generate a public, unauthenticated link to a project&apos;s reference
          sheet. You are solely responsible for what you choose to share this way — anyone with the
          link can view it. You can revoke a share link at any time; revoking it immediately
          disables access for anyone still holding it.
        </p>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>
          You agree not to misuse the service: no attempts to breach security, disrupt the service,
          access other users&apos; data, or use FrameSet for unlawful purposes. We may suspend or
          terminate accounts that violate these rules.
        </p>
      </section>

      <section>
        <h2>6. Availability and changes</h2>
        <p>
          FrameSet is provided &quot;as is&quot;, without warranty of any kind. We work to keep the
          service available and your data safe, but we cannot guarantee uninterrupted operation.
          Features may evolve over time; we may modify or discontinue parts of the service.
        </p>
      </section>

      <section>
        <h2>7. Account deletion</h2>
        <p>
          You can delete your account at any time from your profile page. Deletion is immediate and
          irreversible: your account and all associated projects are permanently removed, bypassing
          the 30-day trash that applies to deleting an individual project, color or standard.
        </p>
      </section>

      <section>
        <h2>8. Liability</h2>
        <p>
          To the maximum extent permitted by law, FrameSet shall not be liable for indirect or
          consequential damages arising from the use of the service, including loss of data.
          Remember to keep your exported reference sheets for anything critical.
        </p>
      </section>

      <section>
        <h2>9. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. The &quot;Last updated&quot; date above
          reflects the latest revision; continuing to use FrameSet after a change means you accept
          the updated terms.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          Questions about these terms? Write to{' '}
          <a href="mailto:axelle.tempier@gmail.com">axelle.tempier@gmail.com</a>, or read the{' '}
          <Link to="/privacy">Privacy Policy</Link> for how your data is handled.
        </p>
      </section>
    </LegalPage>
  );
}
