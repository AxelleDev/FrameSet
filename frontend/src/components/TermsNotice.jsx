import React from 'react';
import { Link } from 'react-router-dom';

// The "by continuing you agree to..." legal notice shown under the sign-in
// methods on Login and Register.
export default function TermsNotice() {
  return (
    <p className="mt-6 text-center text-xs text-primary/60">
      By continuing, you agree to the{' '}
      <Link
        to="/terms"
        className="text-blue hover:text-primary transition-colors underline underline-offset-2"
      >
        Terms of Service
      </Link>{' '}
      and acknowledge the{' '}
      <Link
        to="/privacy"
        className="text-blue hover:text-primary transition-colors underline underline-offset-2"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}
