import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }], "react-hooks/set-state-in-effect": "off", "react-hooks/purity": "off" } },
  globalIgnores([".next/**", "out/**", "next-env.d.ts", ".pgdata/**", "playwright-report/**", "test-results/**"])
]);
