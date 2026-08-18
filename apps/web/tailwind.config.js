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
        paper: {
          50: '#FFFFFF',
          100: '#FBF9F5',
          200: '#F5F1EA',
          300: '#EAE4D9',
        },
        ink: {
          DEFAULT: '#18181B',
          muted: '#52525B',
          light: '#71717A',
        },
        civic: {
          sage: '#DCFCE7',
          sageDark: '#14532D',
          butter: '#FEF3C7',
          butterDark: '#78350F',
          sky: '#E0F2FE',
          skyDark: '#075985',
          coral: '#FFE4E6',
          coralDark: '#881337',
          lavender: '#F3E8FF',
          lavenderDark: '#581C87',
          apricot: '#FFEDD5',
          apricotDark: '#7C2D12',
        }
      },
      boxShadow: {
        'brutal-sm': '2px 2px 0px 0px #18181B',
        'brutal': '3px 3px 0px 0px #18181B',
        'brutal-md': '4px 4px 0px 0px #18181B',
        'brutal-lg': '6px 6px 0px 0px #18181B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
