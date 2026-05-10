/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        avail: '#22c55e',
        unavail: '#ef4444',
        partial: '#f59e0b',
        surface: {
          light: '#f8f7f4',
          dark: '#111110',
        }
      }
    },
  },
  plugins: [],
}
