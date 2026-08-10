import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests only — the areas CLAUDE.md §9 names: CSV column mapping, geocode
 * result handling, plan-limit enforcement, snapshot generation. UI layout is
 * deliberately untested.
 *
 * The `@/` alias is declared by hand rather than via a tsconfig-paths plugin, to
 * avoid another dependency for one mapping.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "packages/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "."),
      // Repositories are server modules. See the stub for why this is needed.
      "server-only": resolve(import.meta.dirname, "lib/test/server-only-stub.ts"),
    },
  },
});
