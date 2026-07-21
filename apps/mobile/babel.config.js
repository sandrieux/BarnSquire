module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // intl-messageformat (via i18next-icu) ships static class blocks that the
    // Expo preset doesn't transform by default.
    plugins: ["@babel/plugin-transform-class-static-block"],
  };
};
