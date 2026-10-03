/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        luxury: {
          950: '#07080A',
          900: '#0B0D11',
          850: '#10131A',
          800: '#161B26',
          700: '#232A3B',
          600: '#333D54',
          500: '#4B5875',
          gold: {
            light: '#F5E6CA',
            DEFAULT: '#D4AF37',
            metallic: '#C5A880',
            dark: '#997E25',
          },
          silver: {
            DEFAULT: '#E2E8F0',
            metallic: '#94A3B8',
          }
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Cinzel', 'Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'luxury-gradient': 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(11, 13, 17, 0.95) 100%)',
        'gold-shimmer': 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.25), transparent)',
        'radial-vignette': 'radial-gradient(circle at center, transparent 40%, rgba(7, 8, 10, 0.85) 100%)',
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      boxShadow: {
        'gold-glow': '0 0 25px -5px rgba(212, 175, 55, 0.35)',
        'gold-glow-lg': '0 0 40px -5px rgba(212, 175, 55, 0.5)',
        'luxury-card': '0 10px 30px -10px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.08)',
        'glass-panel': '0 8px 32px 0 rgba(0, 0, 0, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.07)',
      },
    },
  },
  plugins: [],
};
