import React, { useEffect, useRef, useState } from 'react';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  fullWidth = false,
  className = '',
  disabled = false,
  loading = false,
  minLoadingMs = 0,
  ...rest
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isLoading = loading || internalLoading;

  const base = 'font-medium rounded-xl transition-all inline-flex items-center justify-center gap-2';

  const size = fullWidth ? 'w-full py-4' : 'px-6 py-2.5 text-sm';

  const variants = {
    primary: 'bg-blue text-white hover:bg-pink/10 hover:shadow-lg',
    secondary: 'bg-pink text-white hover:bg-pink/10 hover:shadow-lg',
    ghost: 'bg-transparent text-primary',
  };

  const disabledClass = (disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : '';

  const classes = `${base} ${size} ${variants[variant] || ''} ${disabledClass} ${className}`.trim();

  const handleClick = async (e) => {
    if (!onClick || disabled || isLoading) return;

    const result = onClick(e);
    const isPromise = result && typeof result.then === 'function';
    if (!isPromise) return;

    const startedAt = Date.now();
    setInternalLoading(true);
    try {
      await result;
    } finally {
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
