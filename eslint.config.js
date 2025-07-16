import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "build/**",
      "coverage/**",
      "**/*.min.js",
      "**/*.d.ts",
      ".next/**",
      ".nuxt/**",
      "public/**",
      "apps/*/dist/**",
      "apps/*/build/**",
      "libs/*/dist/**",
      "libs/*/build/**",
      "**/.eslintrc.js",
      "**/eslint.config.js",
      "**/vite.config.*",
      "**/tailwind.config.*",
      "**/*.config.js",
      "**/*.config.ts"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Turn off ALL TypeScript rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "@typescript-eslint/prefer-namespace-keyword": "off",
      "@typescript-eslint/triple-slash-reference": "off",

      // Only keep critical React rules
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",

      // Turn off all warnings and style rules
      "no-console": "off",
      "no-debugger": "off",
      "prefer-const": "off",
      "no-var": "off",
      "no-unused-vars": "off",

      // Keep ONLY critical syntax errors
      "no-undef": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-extra-semi": "error",
      "no-func-assign": "error",
      "no-invalid-regexp": "error",
      "no-obj-calls": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  },
  {
    files: ["apps/ai-workers/**/*.{ts,tsx}", "apps/*-api/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.node, ...globals.browser },
      parser: tseslint.parser,
    },
    rules: {
      // Turn off ALL TypeScript rules for backend files
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "@typescript-eslint/prefer-namespace-keyword": "off",
      "@typescript-eslint/triple-slash-reference": "off",

      // Turn off all warnings and style rules
      "no-console": "off",
      "no-debugger": "off",
      "prefer-const": "off",
      "no-var": "off",
      "no-unused-vars": "off",

      // Keep ONLY critical syntax errors
      "no-undef": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-extra-semi": "error",
      "no-func-assign": "error",
      "no-invalid-regexp": "error",
      "no-obj-calls": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Only keep critical React rules
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",

      // Turn off all warnings and style rules
      "no-console": "off",
      "no-debugger": "off",
      "prefer-const": "off",
      "no-var": "off",
      "no-unused-vars": "off",

      // Keep ONLY critical syntax errors
      "no-undef": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-extra-semi": "error",
      "no-func-assign": "error",
      "no-invalid-regexp": "error",
      "no-obj-calls": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
    },
  }
);
