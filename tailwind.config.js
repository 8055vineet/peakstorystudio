/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        offwhite: {
          50: '#ffffff',
          100: '#faf9f6',
          200: '#f5f3ee',
          300: '#e8e4dc',
          400: '#d5cfc2',
        },
        pitch: {
          950: '#2A0813',
          900: '#3D0C1A',
          800: '#4A0E1E',
          700: '#5C162E',
          600: '#7A1C3C',
        },
        charcoal: {
          900: '#171717',
          800: '#262626',
          700: '#404040',
          500: '#737373',
          400: '#a3a3a3',
        },
        gold: {
          400: '#d4af37',
          500: '#c5a059',
          600: '#a3813c',
        }
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        garamond: ['Cormorant Garamond', 'serif'],
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
}
