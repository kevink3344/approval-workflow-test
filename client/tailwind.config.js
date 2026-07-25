/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Work Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontWeight: {
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      letterSpacing: {
        wide: '.025em',
        wider: '.05em',
      },
      borderRadius: {
        sm: '2px',
        md: '2px',
      },
      colors: {
        accent: '#0078d4',
        navy: {
          900: '#0d2f4f',
          800: '#123555',
          700: '#0f3d63',
        },
        'app-bg': '#f4f7fb',
        'text-primary': '#10243b',
        'text-muted': '#6b7280',
        border: '#e5e7eb',
      },
    },
  },
  plugins: [],
};