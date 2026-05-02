/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: '#070912',
          panel: '#0f1429',
          panel2: '#161c38',
          line: '#1f2748',
          muted: '#8a93b6',
          accent: '#7c5cff',
          accent2: '#22d3ee',
          gold: '#f5b942',
          ok: '#22c55e',
          warn: '#f59e0b',
          err: '#ef4444',
        },
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(124,92,255,0.55)',
        soft: '0 6px 22px -8px rgba(0,0,0,0.55)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': {
          '0%':  { transform: 'scale(0.9)', opacity: '0.7' },
          '100%':{ transform: 'scale(1.6)', opacity: '0'   },
        },
      },
      animation: {
        shimmer: 'shimmer 2.2s infinite',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.215,0.61,0.355,1) infinite',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
