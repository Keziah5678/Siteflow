import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname), "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts") } },
  test: { environment: "node", fileParallelism: false, testTimeout: 30_000, hookTimeout: 60_000 }
});
