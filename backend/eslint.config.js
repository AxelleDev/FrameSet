const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

// Globals exposed by Jest in test files.
const jestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  jest: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
};

module.exports = [
  // Dependencies and coverage reports are never linted.
  { ignores: ['node_modules', 'coverage'] },

  // Application source: Node.js (CommonJS) environment.
  {
    ...js.configs.recommended,
    files: ['src/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      // Allow intentionally unused args/vars prefixed with `_` (e.g. the
      // mandatory 4-arg signature of an Express error handler), and do not
      // flag unused `catch` bindings.
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  // Test files additionally get the Jest globals.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...jestGlobals },
    },
  },

  // Formatting is owned by Prettier; disable conflicting stylistic rules.
  prettier,
];
