import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import next from "@next/eslint-plugin-next";
import hooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/out/**", "**/dist/**", "**/.expo/**", "**/playwright-report/**", "**/test-results/**", "artifacts/**", "web/next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ["web/**/*.tsx", "mobile/**/*.tsx"],
    plugins: { "react-hooks": hooks },
    rules: { ...hooks.configs.recommended.rules }
  },
  {
    files: ["web/**/*.tsx"],
    plugins: { "@next/next": next },
    settings: { next: { rootDir: "web/" } },
    rules: { ...next.configs.recommended.rules, ...next.configs["core-web-vitals"].rules }
  }
);
