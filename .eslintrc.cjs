module.exports = {
  root: true,
  extends: ["next/core-web-vitals"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  ignorePatterns: [".next", ".turbo", "dist", "node_modules"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["apps/api/**/*.ts"],
      rules: { "@next/next/no-html-link-for-pages": "off" },
    },
  ],
};
