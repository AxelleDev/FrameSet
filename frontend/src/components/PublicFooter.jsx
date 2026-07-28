import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import scrollToTop from '../utils/scroll';

// Site-wide footer for every page outside the authenticated app (landing,
// legal pages, shared reference sheets…) — pairs with PublicTopBar so all of
// them share the same chrome, aligned to the same max-w-6xl container. Not
// used on the auth pages (login/register/forgot-password/verify), which keep
// their own focused, chrome-light layout.
export default function PublicFooter() {
  return (
    <footer className="relative border-t border-primary/10">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-primary/60">
        <Link
          to="/"
          onClick={scrollToTop}
          aria-label="Go to homepage"
          className="inline-flex rounded-lg transition-opacity hover:opacity-80 focus-ring w-1/5 max-w-[80px]"
        >
          <Logo className="object-contain w-full h-auto" />
        </Link>
        <nav aria-label="Legal" className="flex items-center gap-5">
          <Link to="/terms" className="hover:text-primary transition-colors rounded focus-ring">
            Terms of Service
          </Link>
          <Link to="/privacy" className="hover:text-primary transition-colors rounded focus-ring">
            Privacy Policy
          </Link>
        </nav>
        <p>© {new Date().getFullYear()} FrameSet. All rights reserved.</p>
      </div>
    </footer>
  );
}
