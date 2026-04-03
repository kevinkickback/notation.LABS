/** @type {import('tailwindcss').Config} */

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
    },
    extend: {
      screens: {
        coarse: { raw: '(pointer: coarse)' },
        fine: { raw: '(pointer: fine)' },
        pwa: { raw: '(display-mode: standalone)' },
      },
    },
  },
  darkMode: ['selector', '[data-appearance="dark"]'],
};
