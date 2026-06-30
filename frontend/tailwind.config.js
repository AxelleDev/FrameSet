/**
 * Design tokens for FrameSet.
 *
 * Colors are driven by CSS variables (RGB channels) defined in `src/index.css`,
 * so the whole palette switches automatically in dark mode (`.dark` class on
 * <html>) without per-component `dark:` classes. The `rgb(var(--x) / <alpha>)`
 * form keeps Tailwind opacity modifiers (e.g. `bg-blue/10`) working.
 *
 * One brand color (`blue`); the rest are system colors: `danger`, `success`,
 * and the neutrals `primary` / `secondary` / `canvas` (page) / `surface` (cards).
 *
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
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
