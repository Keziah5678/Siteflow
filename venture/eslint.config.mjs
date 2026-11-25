import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // French UI copy uses apostrophes everywhere (l'équipe, qu'aimerais-tu…).
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**", "src/lib/supabase/database.types.ts"]),
]);
