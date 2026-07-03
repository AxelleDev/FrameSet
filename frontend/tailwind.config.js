/**
 * Design tokens for FrameSet. Colors come from CSS variables (RGB channels) in
 * src/index.css, so the palette switches in dark mode without per-component `dark:` classes.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        blue: 'rgb(var(--color-blue) / <alpha-value>)',
        pink: 'rgb(var(--color-pink) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      // Named stacking scale for global floating layers. Component-local z values
      // (e.g. content inside a relative card) stay as plain z-10/z-20 since they
      // never interact with these. Toasts sit above modals by design.
      zIndex: {
        dropdown: '1000',
        sticky: '1020',
        overlay: '1035',
        drawer: '1040',
        modal: '1050',
        // Floating menus (e.g. a portaled select): above modals so they show when
        // opened inside one, but below toasts so an open menu can't hide them.
        popover: '1055',
        toast: '1060',
      },
      // Named motion durations. Use these three everywhere instead of raw values.
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        float: 'float 7s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
};
