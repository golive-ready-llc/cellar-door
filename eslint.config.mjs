import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code helper scripts are Node.js CommonJS files, not web app source
    ".claude/**",
    // Scripts are Node.js utilities, allowed to use require() and different idioms
    "scripts/**",
    // Throwaway root-level debug scripts (e.g. test-gemini.cjs) — Node CommonJS,
    // not app source, and untracked. Don't lint them as web app code.
    "test-*.cjs",
    "test-*.mjs",
    // Generated Prisma client
    "src/generated/**",
    // Android build artifacts (generated, not source)
    "android/**",
    // iOS build artifacts
    "ios/**",
  ]),
  // Downgrade React 19 compiler perf hints to warnings — they flag patterns
  // that are stylistically suboptimal (e.g. setMounted(true) in an effect)
  // but don't cause correctness bugs. Real hook/render violations remain
  // errors (rules-of-hooks, purity, immutability).
  {
    // Register the react-hooks plugin in the same config object that references
    // its rules. eslint-config-next registers it too, but flat-config rule
    // resolution requires the plugin to be present in the object where the rule
    // is used — otherwise ESLint fails to load with "could not find plugin
    // react-hooks". Same plugin instance, so no redefine conflict.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      // Allow `_` prefix for intentionally-unused vars (destructuring skips,
      // placeholder parameters). Standard TypeScript convention.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
