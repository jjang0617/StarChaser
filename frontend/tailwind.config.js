/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: [
    './App.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // ── StarChaser Anti-AI 팔레트 ──
      // OKLCH → hex (NativeWind는 OKLCH 미지원)
      colors: {
        background:          '#161618',
        foreground:          '#DEDDE8',
        card:                '#1A1A1D',
        'card-foreground':   '#DEDDE8',
        muted:               '#1E1E22',
        'muted-foreground':  '#6E6E82',
        border:              '#2C2C34',
        'border-subtle':     '#202028',
        input:               '#1A1A20',
        ring:                '#B8922A',
        primary:             '#B8922A',
        'primary-foreground':'#161618',
        secondary:           '#222228',
        'secondary-foreground': '#A8A8BC',
        destructive:         '#7A2E1A',
        'destructive-fg':    '#FFFFFF',
        // StarChaser 전용
        'star-gold':         '#B8922A',
        'nebula-steel':      '#4A4A5E',
        moonlight:           '#C8C8D8',
        'dim-red':           '#7A2E1A',
        'dim-red-fg':        '#C85030',
      },
      borderRadius: {
        DEFAULT: '6px',
        sm:      '4px',
        md:      '6px',
        lg:      '8px',
        xl:      '10px',
        full:    '9999px',
      },
    },
  },
  plugins: [],
};
