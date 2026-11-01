/**
 * The Shopify app's web process in development: `shopify app dev` runs this
 * (distribution/shopify/web/shopify.web.toml) and tunnels the admin to it.
 *
 * It is `npm run dev` from the repo root with three things moved into place:
 *
 * - `APP_URL` becomes the tunnel (`SHOPIFY_APP_URL`). The admin loads the app
 *   there, so same-origin checks, the bounce page's reload address and every
 *   link the server builds have to agree with it (lib/env.ts).
 * - `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` fall back to the CLI's
 *   `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET`, so a fresh checkout works before
 *   `.env` has them.
 * - The port is the one the CLI chose.
 *
 * `next dev` already allows `*.trycloudflare.com` (allowedDevOrigins in
 * next.config.ts), which is the tunnel the CLI opens.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const env = { ...process.env };

if (env.SHOPIFY_APP_URL) env.APP_URL = env.SHOPIFY_APP_URL.replace(/\/+$/, "");
env.SHOPIFY_CLIENT_ID ||= env.SHOPIFY_API_KEY ?? "";
env.SHOPIFY_CLIENT_SECRET ||= env.SHOPIFY_API_SECRET ?? "";

const port = env.PORT || env.FRONTEND_PORT || "3000";
if (!/^\d+$/.test(port)) throw new Error(`[shopify-dev] not a port: ${port}`);

console.log(`[shopify-dev] next dev on port ${port}, APP_URL=${env.APP_URL ?? "(unset)"}`);

// One command string rather than an argument array: Windows needs a shell to
// run npm.cmd, and Node warns (DEP0190) about arrays passed to a shell, which
// it concatenates unescaped. The only variable part is checked to be digits.
const child = spawn(`npm run dev -- -p ${port}`, {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
