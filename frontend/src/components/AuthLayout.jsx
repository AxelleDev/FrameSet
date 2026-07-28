// Layout for authentication pages (login / register).
import React from 'react';
import PropTypes from 'prop-types';
import PublicTopBar from './PublicTopBar';

// Two-column auth layout: a hero/marketing column and a form column.
export default function AuthLayout({ hero, children, swapOnMobile = false }) {
  // Reorder hero/form columns so the form can appear first on small screens.
  const heroOrderClass = swapOnMobile ? 'order-2 md:order-1' : 'order-1';
  const formOrderClass = swapOnMobile ? 'order-1 md:order-2' : 'order-2';

  return (
    <div className="relative min-h-dvh w-full flex flex-col bg-canvas text-primary">
      <PublicTopBar />
      {/* Same max-w-6xl mx-auto px-6 container, applied on the same element, as
          PublicTopBar/PublicFooter/Landing's sections, so the form/hero column
          edges land at the exact same x-position as the logo above — not just
          the same max-width, but the padding on the same element too. */}
      <main className="relative z-10 flex-1 w-full flex items-center pb-8">
        <div className="w-full max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <div
            className={`flex flex-col justify-center space-y-6 animate-fade-in min-w-0 ${heroOrderClass}`}
          >
            {hero}
          </div>
          <div
            className={`flex items-center justify-center md:justify-end min-w-0 ${formOrderClass}`}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

AuthLayout.propTypes = {
  hero: PropTypes.node,
  children: PropTypes.node,
  swapOnMobile: PropTypes.bool,
};
