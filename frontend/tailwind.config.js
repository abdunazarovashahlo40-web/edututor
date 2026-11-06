/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD', 400: '#A78BFA',
          500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9', 800: '#5B21B6', 900: '#4C1D95',
        },
        navy: { 900: '#0B1020', 800: '#111827', 700: '#1E293B', 600: '#334155' },
        accent: '#3B82F6',
        surface: '#F8FAFF',
        card: '#FFFFFF',
        ink: '#111827',
        muted: '#64748B',
        line: '#E8E6F5',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'Manrope', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '28px' },
      boxShadow: {
        soft: '0 1px 2px rgba(17,24,39,.04), 0 8px 24px -8px rgba(76,29,149,.12)',
        lift: '0 20px 50px -20px rgba(76,29,149,.35)',
        glow: '0 0 0 4px rgba(139,92,246,.18)',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { float: 'float 6s ease-in-out infinite', shimmer: 'shimmer 1.4s infinite' },
    },
  },
  plugins: [],
};
