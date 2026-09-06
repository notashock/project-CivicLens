/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        m3: {
          primary: '#1A73E8',
          'on-primary': '#FFFFFF',
          'primary-container': '#E8F0FE',
          'on-primary-container': '#041E49',

          secondary: '#5F6368',
          'on-secondary': '#FFFFFF',
          'secondary-container': '#F1F3F4',
          'on-secondary-container': '#202124',

          tertiary: '#0F9D58',
          'on-tertiary': '#FFFFFF',
          'tertiary-container': '#E6F4EA',
          'on-tertiary-container': '#0D652D',

          surface: '#FFFFFF',
          'surface-dim': '#DED8E1',
          'surface-bright': '#FEF7FF',
          'surface-container-lowest': '#FFFFFF',
          'surface-container-low': '#F8F9FA',
          'surface-container': '#F1F3F4',
          'surface-container-high': '#E9EEF6',
          'surface-container-highest': '#E1E3E1',

          'on-surface': '#1F1F1F',
          'on-surface-variant': '#444746',
          outline: '#747775',
          'outline-variant': '#C4C7C5',

          error: '#BA1A1A',
          'on-error': '#FFFFFF',
          'error-container': '#FFDAD6',
          'on-error-container': '#410002',

          // Status colors
          'status-verified': '#0F9D58',
          'status-verified-container': '#E6F4EA',
          'status-pending': '#EA8600',
          'status-pending-container': '#FEF7E0',
          'status-disputed': '#D93025',
          'status-disputed-container': '#FCE8E6',
        },
      },
      boxShadow: {
        'm3-elevation-1': '0px 1px 3px 1px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.30)',
        'm3-elevation-2': '0px 2px 6px 2px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.30)',
        'm3-elevation-3': '0px 1px 3px 0px rgba(0, 0, 0, 0.30), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
        'm3-elevation-4': '0px 2px 3px 0px rgba(0, 0, 0, 0.30), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
        'm3-elevation-5': '0px 4px 4px 0px rgba(0, 0, 0, 0.30), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
      },
      borderRadius: {
        'm3-xs': '4px',
        'm3-sm': '8px',
        'm3-md': '12px',
        'm3-lg': '16px',
        'm3-xl': '28px',
        'm3-full': '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
