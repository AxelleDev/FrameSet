// Shared layout for legal pages (/terms, /privacy): centered readable column,
// logo link back home, title + last-updated line, then the page's sections.
import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import Seo from './Seo';

export default function LegalPage({ title, path, description, lastUpdated, children }) {
  return (
    <div className="min-h-dvh bg-canvas text-primary px-6 py-10 sm:py-14">
      <Seo title={title} path={path} description={description} />
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to="/"
          aria-label="Go to homepage"
          className="inline-flex rounded-lg transition-opacity hover:opacity-80 focus-ring w-20"
        >
          <Logo className="object-contain w-full h-auto" />
        </Link>

        <h1 className="mt-8 text-3xl sm:text-4xl font-medium tracking-tight">{title}</h1>
        <p className="mt-2 text-xs text-primary/60">Last updated: {lastUpdated}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-primary/80 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-primary [&_h2]:mb-2 [&_a]:text-blue [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary">
          {children}
        </div>

        <div className="mt-12 border-t border-primary/10 pt-6">
          <Link
            to="/"
            className="text-sm font-medium text-blue hover:text-primary transition-colors"
          >
            ← Back to FrameSet
          </Link>
        </div>
      </div>
    </div>
  );
}
