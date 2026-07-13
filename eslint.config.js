import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["bin/**/*.js", "lib/**/*.js", "test/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        // Node globals the CLI and tests rely on (incl. the built-in fetch).
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        Response: "readonly",
        URL: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        globalThis: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
    },
  },
];
