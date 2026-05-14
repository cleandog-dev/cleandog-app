import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        /* shadcn compat */
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        /* Design tokens */
        sage: {
          900: '#2A4032', 800: '#3D5A47', 700: '#4A6B54',
          600: '#5C7A5E', 300: '#A8BCA9', 100: '#DCE5DD',
        },
        brown: {
          800: '#5C4631', 700: '#8B6A4F', 500: '#A6886A',
          300: '#C4A882', 100: '#E8D9C3',
        },
        cream: {
          50: '#FBF7EF', 100: '#F5EDE0',
          200: '#EEE3D0', 300: '#E2D4BC',
        },
        ink: {
          900: '#1F1A14', 700: '#4A3F32',
          500: '#7A6B57', 300: '#B5A78F',
        },
      },
      borderRadius: {
        sm: '8px', md: '14px', lg: '22px',
        xl: '32px', pill: '999px',
        DEFAULT: '14px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(92,70,49,.08), 0 2px 6px rgba(92,70,49,.04)',
        md: '0 4px 12px rgba(92,70,49,.10), 0 8px 24px rgba(92,70,49,.06)',
        lg: '0 12px 28px rgba(92,70,49,.14), 0 24px 48px rgba(92,70,49,.08)',
        glow: '0 0 0 4px rgba(61,90,71,.12)',
      },
      keyframes: {
        stepEnter: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(2deg)' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.04)', opacity: '0.85' },
        },
      },
      animation: {
        'step-enter': 'stepEnter 620ms cubic-bezier(0.34,1.2,0.42,1) both',
        'floaty': 'floaty 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
