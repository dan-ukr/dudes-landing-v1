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
        // MountainDude — from the CoachDude concept guide, dark-mode system
        'md-lime': '#E3F265',
        'md-white': '#E7E7E7',
        'md-purple': '#B5A1FE',
        'md-gray': '#202020',
        // HungryDude — placeholder palette, no brand assets yet (see plan)
        'hd-amber': '#FFB454',
        'hd-cream': '#FFF3E1',
        'hd-brown': '#3A2418',
        // DUDES parent brand
        'dd-navy': '#160A33',
        'dd-blue': '#6C5CE7',
      },
    },
  },
  plugins: [],
};