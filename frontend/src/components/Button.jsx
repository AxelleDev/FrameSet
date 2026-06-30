import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Themed button with optional async loading state. If `onClick` returns a
 * promise, the button shows a spinner and disables itself until it settles
 * (respecting an optional minimum display time). When `to` or `href` is given,
 * it renders a router Link / anchor with the exact same styling instead.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Button label/content.
 * @param {Function} [props.onClick] - Click handler; may return a promise to drive the loading state.
 * @param {string} [props.type] - Native button type (defaults to "button").
 * @param {'primary'|'danger'|'ghost'|'outline'} [props.variant] - Visual variant.
 * @param {boolean} [props.fullWidth] - Stretch to full width with larger padding.
 * @param {string} [props.to] - Render as a react-router Link to this route.
 * @param {string} [props.href] - Render as an anchor to this URL.
 * @param {string} [props.className] - Extra classes.
 * @param {boolean} [props.disabled] - Disable the button.
 * @param {boolean} [props.loading] - Externally controlled loading state.
 * @param {number} [props.minLoadingMs] - Minimum spinner display time in ms for async clicks.
 */
export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  fullWidth = false,
  to,
  href,
  className = '',
  disabled = false,
  loading = false,
  minLoadingMs = 0,
  ...rest
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  // Guards against state updates after unmount when an async onClick resolves late.
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Loading is driven either externally (prop) or internally (async onClick).
  const isLoading = loading || internalLoading;

  const base =
    'font-medium rounded-xl transition-all inline-flex items-center justify-center gap-2 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 focus-visible:ring-offset-2';

  const size = fullWidth ? 'w-full py-4 text-sm' : 'px-6 py-2.5 text-sm';

  const variants = {
    primary: 'bg-blue text-white hover:bg-blue/90',
    danger: 'bg-danger text-white hover:bg-danger/90',
    ghost: 'bg-transparent text-primary hover:bg-blue/10',
    outline: 'bg-blue/10 text-blue hover:bg-blue/20',
  };

  const disabledClass = (disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : '';

  const classes = `${base} ${size} ${variants[variant] || ''} ${disabledClass} ${className}`.trim();

  // Render as a navigation link when `to`/`href` is provided (no async loading).
  if (to) {
    return <Link to={to} className={classes} {...rest}>{children}</Link>;
  }
  if (href) {
    return <a href={href} className={classes} {...rest}>{children}</a>;
  }

  const handleClick = async (e) => {
    if (!onClick || disabled || isLoading) return;

    const result = onClick(e);
    // Only manage a loading state when the handler is asynchronous.
    const isPromise = result && typeof result.then === 'function';
    if (!isPromise) return;

    const startedAt = Date.now();
    setInternalLoading(true);
    try {
      await result;
    } finally {
      // Keep the spinner visible for at least minLoadingMs to avoid flicker.
      const remaining = Math.max(0, Number(minLoadingMs || 0) - (Date.now() - startedAt));
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      if (isMountedRef.current) {
        setInternalLoading(false);
      }
    }
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={classes}
      {...rest}
    >
      {isLoading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
