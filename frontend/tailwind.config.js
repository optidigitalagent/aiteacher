/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          400: '#6b82f8',
          500: '#4f6ef7',
          700: '#3451d1',
          900: '#1e3a8a',
        },
        cls: {
          bg:           '#F7F6F3',
          surface:      '#FFFFFF',
          surface2:     '#F0EFec',
          border:       'rgba(0,0,0,0.07)',
          'border-md':  'rgba(0,0,0,0.11)',
          accent:       '#3D55C9',
          'accent-dim': '#6677D6',
          'accent-lgt': '#EEF1FB',
          text:         '#111827',
          muted:        '#6B7280',
          faint:        '#9CA3AF',
        },
      },
      keyframes: {
        'speak-ring': {
          '0%':   { transform: 'scale(1)',    opacity: '0.55' },
          '70%':  { transform: 'scale(1.22)', opacity: '0' },
          '100%': { transform: 'scale(1.22)', opacity: '0' },
        },
        'slide-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',    opacity: '1' },
        },
        'fade-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',   opacity: '1' },
        },
        'modal-in': {
          from: { transform: 'scale(0.96)', opacity: '0' },
          to:   { transform: 'scale(1)',    opacity: '1' },
        },
        'pulse-bar': {
          '0%, 100%': { transform: 'scaleY(0.35)', opacity: '0.5' },
          '50%':      { transform: 'scaleY(1)',    opacity: '1'   },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        'speak-ring':  'speak-ring 1.8s ease-out infinite',
        'slide-right': 'slide-right 0.22s ease-out',
        'fade-up':     'fade-up 0.18s ease-out',
        'modal-in':    'modal-in 0.18s ease-out',
        'pulse-bar':   'pulse-bar 1s ease-in-out infinite',
        'fade-in':     'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
}
