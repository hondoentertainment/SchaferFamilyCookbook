import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11Y from "eslint-plugin-jsx-a11y";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "*.config.*",
      "scripts/**",
      "api/recipes.seed.generated.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11Y,
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    settings: {
      react: { version: "19.2.3" },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "prefer-const": "error",
      "no-var": "error",
      ...jsxA11Y.configs.recommended.rules,
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/no-autofocus": "warn",
      "jsx-a11y/mouse-events-have-key-events": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": [
        "warn",
        {
          handlers: ["onClick", "onMouseDown", "onMouseUp", "onKeyDown", "onKeyUp", "onKeyPress"],
        },
      ],
      "jsx-a11y/role-supports-aria-props": "warn",
      "jsx-a11y/no-interactive-element-to-noninteractive-role": "warn",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**/*.ts", "src/test/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/context/**/*.tsx", "src/test/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
