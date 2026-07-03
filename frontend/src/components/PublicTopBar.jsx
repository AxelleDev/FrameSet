import React from 'react';
import ThemeToggle from './ThemeToggle';

// Sticky top bar for public pages: mirrors the app header so the theme toggle
// stays put instead of scrolling away with the content.
export default function PublicTopBar() {
  return (
    <header className="sticky top-0 z-sticky flex h-16 sm:h-20 items-center px-4 sm:px-6 md:px-8 bg-canvas/70 backdrop-blur-md">
      <div className="ml-auto shrink-0">
        <ThemeToggle />
      </div>
    </header>
  );
}
