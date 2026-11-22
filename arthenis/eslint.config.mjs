import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // French UI copy uses apostrophes everywhere.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
      // Generated art is data: URLs / signed storage URLs of unknown size.
      "@next/next/no-img-element": "off",
      // Imperative canvas/three.js code mutates refs by design.
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  },
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "playwright-report/**", "test-results/**"])
]);
