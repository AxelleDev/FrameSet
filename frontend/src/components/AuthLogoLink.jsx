import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

// The "go back home" logo link at the top of every auth-hero panel (Login,
// Register, ForgotPassword, Verify) — identical everywhere it appears.
export default function AuthLogoLink() {
  return (
    <div className="flex items-center mb-2">
      <Link
        to="/"
        aria-label="Go to homepage"
        className="inline-flex rounded-lg transition-opacity hover:opacity-80 focus-ring w-24 sm:w-20"
      >
        <Logo className="object-contain w-full h-auto" />
      </Link>
    </div>
  );
}
