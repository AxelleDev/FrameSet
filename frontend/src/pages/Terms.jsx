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
      lastUpdated="July 19, 2026"
    >
      <section>
        <h2>1. About FrameSet</h2>
        <p>
          FrameSet is a web application that lets illustrators and creatives centralize the graphic
          references of their projects — color palettes, typography and brush specifications — and
          export them as reference sheets. By creating an account or using FrameSet, you agree to
          these terms.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <p>
          You can create an account with an email address and password, or by continuing with
          Google. You are responsible for keeping your credentials confidential and for the activity
          that happens under your account. You must provide accurate information and be legally able
          to enter into this agreement.
        </p>
      </section>

      <section>
        <h2>3. Your content</h2>
        <p>
          The projects, palettes and specifications you create remain yours. FrameSet claims no
          ownership over your content and only stores and processes it to provide the service — for
          example to display your projects and generate your PDF exports.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>
          You agree not to misuse the service: no attempts to breach security, disrupt the service,
          access other users&apos; data, or use FrameSet for unlawful purposes. We may suspend or
          terminate accounts that violate these rules.
        </p>
      </section>

      <section>
        <h2>5. Availability and changes</h2>
        <p>
          FrameSet is provided &quot;as is&quot;, without warranty of any kind. We work to keep the
          service available and your data safe, but we cannot guarantee uninterrupted operation.
          Features may evolve over time; we may modify or discontinue parts of the service.
        </p>
      </section>

      <section>
        <h2>6. Account deletion</h2>
        <p>
          You can delete your account at any time from your profile page. Deletion is immediate and
          irreversible: your account and all associated projects are permanently removed.
        </p>
      </section>

      <section>
        <h2>7. Liability</h2>
        <p>
          To the maximum extent permitted by law, FrameSet shall not be liable for indirect or
          consequential damages arising from the use of the service, including loss of data.
          Remember to keep your exported reference sheets for anything critical.
        </p>
      </section>

      <section>
        <h2>8. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. The &quot;Last updated&quot; date above
          reflects the latest revision; continuing to use FrameSet after a change means you accept
          the updated terms.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions about these terms? See the contact section of the project, or read the{' '}
          <Link to="/privacy">Privacy Policy</Link> for how your data is handled.
        </p>
      </section>
    </LegalPage>
  );
}
