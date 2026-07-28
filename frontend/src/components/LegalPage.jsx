// Shared layout for legal pages (/terms, /privacy): same public chrome
// (PublicTopBar/PublicFooter) as every other out-of-app page. The page shell
// is the same max-w-6xl mx-auto px-6 container as everywhere else (so it
// starts at the exact same left edge as the logo above); the actual legal
// text sits in a narrower column inside it, capped for readability but
// left-aligned to that same edge rather than re-centered on its own.
import React from 'react';
import PublicTopBar from './PublicTopBar';
import PublicFooter from './PublicFooter';
import Seo from './Seo';

export default function LegalPage({ title, path, description, lastUpdated, children }) {
  return (
    <div className="min-h-dvh flex flex-col bg-canvas text-primary">
      <Seo title={title} path={path} description={description} />
      <PublicTopBar />

      <main className="flex-1 py-10 sm:py-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="w-full max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-light tracking-tight">{title}</h1>
            <p className="mt-2 text-xs text-primary/60">Last updated: {lastUpdated}</p>

            <div className="mt-8 space-y-8 text-sm leading-relaxed text-primary [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-primary [&_h2]:mb-2 [&_a]:text-blue [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary">
              {children}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
