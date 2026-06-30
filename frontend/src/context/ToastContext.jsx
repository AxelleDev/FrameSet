import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lightweight toast system for transient feedback (success / error / info).
 * Flat design (no shadow), opaque surface with a faint ring for separation, a
 * colored leading icon per variant, auto-dismiss, and an accessible live region.
 */
const ToastContext = createContext(null);

let toastId = 0;

const ICONS = {
  success: {
    className: 'text-success',
    path: 'M5 13l4 4L19 7',
  },
  error: {
    className: 'text-danger',
    path: 'M6 18L18 6M6 6l12 12',
  },
  info: {
    className: 'text-blue',
    path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const showToast = useCallback(
    (message, variant = 'success', duration = 3500) => {
      const id = ++toastId;
      setToasts((list) => [...list, { id, message, variant }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      {createPortal(
        <div
          className="fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((toast) => {
            const icon = ICONS[toast.variant] || ICONS.info;
            return (
              <div
                key={toast.id}
                role={toast.variant === 'error' ? 'alert' : 'status'}
                className="flex items-start gap-3 rounded-xl bg-surface px-4 py-3 text-sm font-medium text-primary ring-1 ring-black/5 animate-fade-in"
              >
                <svg className={`mt-0.5 h-5 w-5 flex-shrink-0 ${icon.className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon.path} />
                </svg>
                <span className="flex-1">{toast.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Fermer la notification"
                  className="text-primary/40 transition-colors hover:text-primary"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

const NOOP_TOAST = { showToast: () => {}, dismiss: () => {} };

/**
 * Returns the toast API. Degrades gracefully to no-ops when used outside a
 * ToastProvider (e.g. isolated component tests) so callers never crash.
 */
export function useToast() {
  return useContext(ToastContext) || NOOP_TOAST;
}
