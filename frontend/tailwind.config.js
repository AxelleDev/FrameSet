import defaultColors from 'tailwindcss/colors';

/**
 * Design tokens for FrameSet.
 *
 * One brand color — `blue` (#8994DF, periwinkle) — drives actions, focus,
 * accents and decoration. The rest are system colors: `danger` (red) for
 * destructive/error states, `success` (green), and the neutrals `primary` /
 * `secondary` / `canvas`. `blue` keeps Tailwind's default numeric shades (used
 * for decorative blobs/shadows) and only overrides the bare `DEFAULT`.
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
        canvas: '#f6f7ff',
        success: '#3E9D7B',
        danger: '#DC2626',
        blue: { ...defaultColors.blue, DEFAULT: '#8994DF' },
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
