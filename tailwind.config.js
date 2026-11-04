/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#101010',
      },
      fontFamily: {
        title: ['Montserrat', 'sans-serif'],
        body: ['Syne', 'sans-serif'],
      },
      // Escala tipográfica padrão do Tailwind, com +2px em cada degrau para
      // melhorar legibilidade/acessibilidade em todo o site.
      fontSize: {
        xs: ['0.875rem', { lineHeight: '1rem' }],
        sm: ['1rem', { lineHeight: '1.25rem' }],
        base: ['1.125rem', { lineHeight: '1.5rem' }],
        lg: ['1.25rem', { lineHeight: '1.75rem' }],
        xl: ['1.375rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.625rem', { lineHeight: '2rem' }],
        '3xl': ['2rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.375rem', { lineHeight: '2.5rem' }],
        '5xl': ['3.125rem', { lineHeight: '1' }],
        '6xl': ['3.875rem', { lineHeight: '1' }],
        '7xl': ['4.625rem', { lineHeight: '1' }],
      },
    },
  },
  plugins: [],
}
