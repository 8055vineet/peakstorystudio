import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // .superpowers/ holds planning artefacts and throwaway verification
  // scripts, never shipped code. Only .superpowers/sdd/** is actually
  // git-ignored, via a nested .gitignore the tooling writes there;
  // .superpowers/ itself is not covered by the repo's top-level .gitignore.
  // ESLint ignores the whole tree regardless of that distinction, since none
  // of it is source code and linting it would fail the build on files that
  // are never shipped.
  { ignores: ['dist/**', 'node_modules/**', '.superpowers/**'] },
  {
    // .mjs is included so scripts/check-docs.mjs is actually linted, and .cjs
    // so tool configs written in CommonJS are covered too; without them
    // those files match no rules block and are silently skipped. TypeScript
    // (.ts/.tsx) is deliberately excluded — out of scope for this project.
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: '18.2' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // The project uses the automatic JSX runtime, so React need not be in scope.
      'react/react-in-jsx-scope': 'off',
      // Prop types are not used in this codebase; documentation lives in docs/COMPONENTS.md.
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Test files import describe/it/expect/vi explicitly from 'vitest', so no
    // test-runner globals need declaring here — only Node's, for setup files.
    // (Do not reach for `globals.vitest`; the globals package does not export
    // that key, and spreading undefined would silently declare nothing.)
    files: ['src/**/__tests__/**/*.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Node scripts, not browser code.
    files: ['scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Supabase Edge Functions run on Deno. They get browser globals (fetch,
    // Response, crypto, TextEncoder are all present there) plus Deno itself.
    // _shared/ deliberately uses neither, so it can also run in the browser.
    files: ['supabase/functions/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, Deno: 'readonly' },
    },
  },
];
