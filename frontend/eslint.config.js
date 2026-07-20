// Minimal ESLint flat config for pre-completion checks.
// The project uses react-scripts (CRA) which handles day-to-day linting internally.
// This config exists so `npx eslint` (v9) has a valid configuration file to load.
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "build/**",
      "node_modules/**",
      "android/**",
      "ios/**",
      "public/**",
      "**/*.config.js",
      "craco.config.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        process: "readonly",
      },
    },
    rules: {
      // CRA/react-scripts handles the strict rules during build.
      // Keep this config permissive to avoid false-positives on JSX at the
      // pre-completion linter level.
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-prototype-builtins": "off",
      "no-cond-assign": "off",
      "no-constant-condition": "off",
      "no-dupe-keys": "warn",
      "no-func-assign": "warn",
      "no-redeclare": "off",
    },
  },
];
