/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [ // 테일윈드가 적용될 파일 목록
    './App.{js,jsx,ts,tsx}',
    './**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {}, // 테일윈드 확장 옵션
  },
  plugins: [], // 테일윈드 플러그인
};