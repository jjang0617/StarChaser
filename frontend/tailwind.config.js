/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  // 테일윈드가 적용될 파일 목록
  content: [
    './App.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // 스타일 가이드 v1
      // shadcn 토큰 체계를 RN/NativeWind로 번역한 권장값
      colors: {
        background: '#0B0B0F', // Dark background 색상
        foreground: '#FFFFFF', // White foreground 색상
        card: '#14141A', // Dark card 색상
        'card-foreground': '#FFFFFF', // White card foreground 색상
        muted: '#1C1C24', // Dark muted 색상
        'muted-foreground': '#A1A1AA', // Gray muted foreground 색상
        border: '#27272A', // Dark border 색상
        primary: '#C9A84C', // Gold 색상
        'primary-foreground': '#0B0B0F', // Dark primary foreground 색상
        destructive: '#FF5A3A', // Red 색상(조금 더 부드러운 톤)
      },
      borderRadius: {
        xl: '12px',
      },
    },
  },
  plugins: [],
};