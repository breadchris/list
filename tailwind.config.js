/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: 'rgb(255, 255, 227)',
        subtle: 'rgb(248, 248, 221)',
        highlight: 'rgb(255, 241, 181)',
        primary: 'rgb(16, 16, 14)',
        secondary: 'rgb(48, 48, 43)',
        tertiary: 'rgb(96, 96, 85)',
        border: {
          DEFAULT: 'rgb(232, 232, 207)',
          muted: 'rgb(192, 192, 171)',
        },
        accent: { 
          link: 'rgb(0, 0, 0)' 
        },
        state: { 
          danger: 'rgba(192, 192, 171, 0.5)' 
        },
      },
      fontFamily: {
        'ui': ['Satoshi', 'ui-sans-serif', 'system-ui', 'Inter', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        'content': ['Satoshi', 'ui-sans-serif', 'system-ui', 'Inter', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        'sans': ['Satoshi', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        'satoshi': ['Satoshi', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.45' }],
        sm: ['14px', { lineHeight: '1.45' }],
        md: ['16px', { lineHeight: '1.45' }],
        lg: ['20px', { lineHeight: '1.35' }],
        xl: ['28px', { lineHeight: '1.25' }],
        display: ['48px', { lineHeight: '1.2' }],
      },
      lineHeight: {
        tight: '1.2',
        normal: '1.45',
        loose: '1.6',
      },
      spacing: {
        's1': '4px',
        's2': '8px',
        's3': '12px',
        's4': '16px',
        's5': '20px',
        's6': '24px',
        's8': '32px',
        's10': '40px',
        's12': '48px',
        's14': '56px',
        's16': '64px',
      },
      borderRadius: {
        none: '0',
        sm: '6px',
        lg: '12px',
      },
      boxShadow: {
        none: 'none',
        sm: '0 1px 2px rgba(0,0,0,0.04)',
      },
      ringWidth: {
        2: '2px',
      },
      ringColor: {
        DEFAULT: 'rgb(48, 48, 43)',
        secondary: 'rgb(48, 48, 43)',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
        slow: '240ms',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    function({ addComponents }) {
      addComponents({
        '.text-display': { 
          fontSize: '48px', 
          lineHeight: '1.2', 
          fontWeight: '600' 
        },
        '.h-header': { 
          height: '64px' 
        },
        '.h-header-sm': { 
          height: '56px' 
        },
        '.h-toolbar': { 
          height: '48px' 
        },
      })
    }
  ],
}