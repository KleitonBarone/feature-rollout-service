import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@feature-rollout/evaluation": fileURLToPath(
        new URL("./packages/evaluation/src/index.ts", import.meta.url),
      ),
    },
  },
  test: { include: ["packages/*/test/**/*.test.ts"] },
});
