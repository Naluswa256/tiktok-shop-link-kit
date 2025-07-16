module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: [],
  rules: {
    // Turn off ALL warnings and style rules
    'no-console': 'off',
    'no-debugger': 'off',
    'prefer-const': 'off',
    'no-var': 'off',
    'no-unused-vars': 'off',

    // Keep ONLY critical syntax errors that prevent code from running
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-extra-semi': 'error',
    'no-func-assign': 'error',
    'no-invalid-regexp': 'error',
    'no-obj-calls': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
  },
  overrides: [
    // Frontend specific rules
    {
      files: ['apps/frontend/**/*.{ts,tsx}'],
      env: {
        browser: true,
        es2022: true,
      },
      extends: [
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
      ],
      plugins: ['react', 'react-hooks', 'jsx-a11y'],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'react/display-name': 'off',
        'react-hooks/rules-of-hooks': 'error', // Keep this as it prevents runtime errors
        'react-hooks/exhaustive-deps': 'off', // Turn off dependency warnings
        'jsx-a11y/anchor-is-valid': 'off',
        'react-refresh/only-export-components': 'off', // Turn off React refresh warnings
      },
    },
    // NestJS specific rules
    {
      files: ['apps/*-api/**/*.ts', 'apps/*-service/**/*.ts'],
      extends: [],
      rules: {
        // No additional rules needed since TypeScript plugin is disabled
      },
    },
    // Python files (basic linting)
    {
      files: ['apps/ai-workers/**/*.py'],
      extends: [],
      rules: {},
    },
    // Test files
    {
      files: ['**/*.test.{ts,tsx,js}', '**/*.spec.{ts,tsx,js}'],
      env: {
        jest: true,
      },
      extends: ['plugin:jest/recommended'],
      plugins: ['jest'],
      rules: {
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/prefer-to-have-length': 'warn',
        'jest/valid-expect': 'error',
      },
    },
    // Configuration files
    {
      files: ['*.config.{ts,js}', '.*rc.{ts,js}'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.min.js',
    'public/',
    '.next/',
    '.nuxt/',
    'apps/frontend/src/vite-env.d.ts',
  ],
};
