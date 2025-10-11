module.exports = {
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["import"],
  rules: {
    "no-use-before-define": "error"
  }
};
