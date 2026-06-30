// Layout for authentication pages (login / register).
import React from 'react';

/**
 * Two-column layout for auth screens: a hero/marketing column and a form column
 * on a flat solid background.
 *
 * @param {object} props
 * @param {React.ReactNode} props.hero - Content for the hero/marketing column.
 * @param {React.ReactNode} props.children - The form (rendered in the second column).
 * @param {boolean} [props.swapOnMobile] - When true, shows the form above the hero on mobile.
 */
export default function AuthLayout({ hero, children, swapOnMobile = false }) {
  // Reorder hero/form columns so the form can appear first on small screens.
  const heroOrderClass = swapOnMobile ? 'order-2 md:order-1' : 'order-1';
  const formOrderClass = swapOnMobile ? 'order-1 md:order-2' : 'order-2';

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-canvas text-primary">
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 p-8">
        <div className={`flex flex-col justify-center space-y-6 animate-fade-in ${heroOrderClass}`}>
          {hero}
        </div>
        <div className={`flex items-center justify-center md:justify-end ${formOrderClass}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
