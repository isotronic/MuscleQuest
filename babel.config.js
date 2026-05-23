module.exports = function (api) {
  // @lingui/babel-plugin-lingui-macro is a native ESM module that can't run
  // synchronously in Jest's transform pipeline — skip it during tests.
  const isTest = api.env("test");
  api.cache.using(() => process.env.NODE_ENV);
  return {
    presets: ["babel-preset-expo"],
    plugins: isTest ? [] : ["@lingui/babel-plugin-lingui-macro"],
  };
};
