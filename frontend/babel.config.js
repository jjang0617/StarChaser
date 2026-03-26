module.exports = function (api) {
  api.cache(true);
  return {
    // 프리셋: expo 프리셋과 nativewind 플러그인 적용
    presets: ['babel-preset-expo', 'nativewind/babel'],
  };
};