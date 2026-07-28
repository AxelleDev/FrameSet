import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import scrollToTop from '../utils/scroll';

// Sticky top bar for every page outside the authenticated app: mirrors the
// in-app header so the logo (home link) and theme toggle stay put instead of
// scrolling away with the content. The inner row shares the same max-w-6xl
// container as the rest of the public pages (see PublicFooter, Landing's
// sections), so the logo and toggle line up with the content edges below
// instead of sitting flush against the viewport edges. The single place
// these pages get their logo — pages using this bar must not render their
// own, or it doubles up.
export default function PublicTopBar() {
  return (
    <header className="sticky top-0 z-sticky bg-canvas/70 backdrop-blur-md">
      <div className="max-w-6xl mx-auto flex h-16 sm:h-20 items-center px-6">
        <Link
          to="/"
          onClick={scrollToTop}
          aria-label="Go to homepage"
          className="inline-flex rounded-lg transition-opacity hover:opacity-80 focus-ring w-1/5 max-w-[80px]"
        >
          <Logo className="object-contain w-full h-auto" />
        </Link>
        <div className="ml-auto shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
