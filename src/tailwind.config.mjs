/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'wd-pink': '#FF86CE',
        'wd-lime': '#D0FF00',
        'wd-yellow': '#FFE100',
        'wd-white': '#FFEAF4',
      },
    },
  },
  plugins: [],
};