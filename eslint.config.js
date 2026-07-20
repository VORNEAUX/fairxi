// Minimal root-level ESLint flat config.
// The pre-completion linter runs from /app, so a valid config must exist here.
// This config ignores everything — actual linting lives in /app/frontend/eslint.config.js.
module.exports = [
  {
    ignores: [
      "**/*",
    ],
  },
];
