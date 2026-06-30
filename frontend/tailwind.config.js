import defaultColors from 'tailwindcss/colors';

/**
 * Design tokens for FrameSet.
 *
 * The brand colors (primary / secondary / blue / pink) are defined here as real
 * theme colors so opacity modifiers like `bg-blue/10` or `ring-pink/40` work.
 * `blue` and `pink` keep Tailwind's default numeric shades (used for decorative
 * blobs/shadows) and only override the bare `DEFAULT` with the brand hue.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#3C3D48',
        secondary: '#AFAFAF',
        canvas: '#F8F9FF',
        blue: { ...defaultColors.blue, DEFAULT: '#8994DF' },
        pink: { ...defaultColors.pink, DEFAULT: '#FF9292' },
        lavender: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          DEFAULT: '#B9A7E8',
          dark: '#5B4E7A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        blob: 'blob 10s infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
