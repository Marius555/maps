import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // CLAUDE.md §5: all Appwrite access goes through /lib/repositories. Routes and
  // components must never reach for the SDK directly.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "node-appwrite",
              message:
                "Appwrite access goes through /lib/repositories (CLAUDE.md §5).",
            },
            {
              name: "appwrite",
              message:
                "Appwrite access goes through /lib/repositories (CLAUDE.md §5).",
            },
          ],
        },
      ],
    },
  },
  // CLAUDE.md §4: the embed is a separate build target that loads on strangers'
  // websites. It gets MapLibre, pmtiles and our own code — nothing else. Stated
  // as a rule rather than a convention, because the cost of breaking it is
  // invisible until someone measures the bundle.
  //
  // /packages/shared is held to the same list, not because it ships to visitors
  // itself, but because whatever it imports the embed inherits. It is the one
  // directory both build targets read, so it is the one place a dependency could
  // reach the visitor without anyone importing it from /embed.
  {
    files: ["embed/**/*.ts", "packages/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "react",
            "react-dom",
            "@heroui/react",
            "@heroui/styles",
            "motion",
            "@tanstack/react-query",
            "zustand",
            "appwrite",
            "node-appwrite",
            "zod",
            "react-hook-form",
            "date-fns",
          ].map((name) => ({
            name,
            message:
              "The embed ships to visitors' browsers and must stay vanilla TS " +
              "plus MapLibre (CLAUDE.md §4).",
          })),
          patterns: [
            {
              group: ["@/lib/*", "@/components/*", "@/app/*"],
              message:
                "Only @/packages/shared may cross into the embed (CLAUDE.md §4) " +
                "— and what it holds must be types, or vanilla TS with no " +
                "dependencies. Move the code there, or copy the lines.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Provisioning scripts are plain ESM run by node, not part of the app build.
    "scripts/**",
    // Vendored MapLibre worker bundle, copied in by scripts/copy-maplibre-worker.mjs.
    // Third-party minified output — not ours to lint.
    "public/maplibre/**",
    // Built by `npm run build:embed` from /embed. Linting minified output of our
    // own build produces thousands of meaningless warnings.
    "public/embed/**",
  ]),
]);

export default eslintConfig;
