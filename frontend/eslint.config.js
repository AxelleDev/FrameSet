import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

// Globals exposed by Vitest when `globals: true` is set in vite.config.js.
const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  vi: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
};

export default [
  // Build output, dependencies and coverage reports are never linted.
  { ignores: ['dist', 'node_modules', 'coverage'] },

  // Application and test source: browser environment, React component rules.
  {
    ...js.configs.recommended,
    files: ['src/**/*.{js,jsx}', 'tests/**/*.{js,jsx}', '*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Test files additionally get the Vitest and jsdom/node globals.
  {
    files: ['tests/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...vitestGlobals },
    },
  },

  // Context modules deliberately co-locate the provider component with the
  // context object and its accessor hook; the fast-refresh "only export
  // components" rule does not apply to this intentional pattern.
  {
    files: ['src/context/**/*.{js,jsx}'],
    plugins: { 'react-refresh': reactRefresh },
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Formatting is owned by Prettier; disable conflicting stylistic rules.
  prettier,
];
