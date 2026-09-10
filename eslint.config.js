const js = require('@eslint/js');
const security = require('eslint-plugin-security');
const globals = require('globals');

module.exports = [
  { ignores: ['**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  security.configs.recommended, // static analysis for common Node.js security pitfalls
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // Dev tooling (not deployed): reading files by path and spawning npm is expected here.
    files: ['scripts/**/*.js'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-child-process': 'off',
    },
  },
];
