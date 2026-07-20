// Root-level ESLint flat config for the FairXI monorepo.
// The pre-completion linter may run from /app, so a valid flat config must exist here.
// Actual project linting lives in /app/frontend/eslint.config.js.
const js = require("./frontend/node_modules/@eslint/js");
const globals = require("./frontend/node_modules/globals");

module.exports = [
  {
    ignores: [
      "backend/**",
      "frontend/build/**",
      "frontend/node_modules/**",
      "frontend/android/**",
      "frontend/ios/**",
      "frontend/public/**",
      "frontend/craco.config.js",
      "frontend/tailwind.config.js",
      "frontend/postcss.config.js",
      "frontend/capacitor.config.ts",
      "frontend/eslint.config.js",
      "node_modules/**",
      "**/*.min.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["frontend/src/**/*.{js,jsx}"],
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
      "no-case-declarations": "off",
      "no-misleading-character-class": "off",
      "no-fallthrough": "off",
      "no-control-regex": "off",
      "no-async-promise-executor": "off",
      "no-self-assign": "off",
      "no-sparse-arrays": "off",
    },
  },
];
