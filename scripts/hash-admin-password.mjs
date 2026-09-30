#!/usr/bin/env node
/**
 * Make the operator console's credentials: `npm run admin:hash`.
 *
 * Reads the password from stdin — typed at the prompt, or piped — and never
 * from argv, so it does not land in shell history or a process listing. Prints
 * the two lines to paste into `.env` and into the site's environment on
 * Appwrite Sites:
 *
 *   ADMIN_PASSWORD_HASH=scrypt:32768:8:1:<salt>:<hash>
 *   ADMIN_SESSION_SECRET=<48 random bytes>
 *
 * `ADMIN_EMAIL` is the third value and is typed by hand.
 *
 * Must produce what `lib/admin/auth/password.ts` verifies — same format, same
 * parameters. The format has no `$` in it because Next's dotenv-expand would
 * read `$N` as a variable (see that file).
 *
 * `--no-secret` prints the hash alone, for changing the password without
 * signing the admin out a second way.
 */
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";

const N = 32_768;
const R = 8;
const P = 1;

function readPassword() {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => (data += chunk));
      process.stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
      return;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Admin password: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

const password = await readPassword();

if (password.length < 12) {
  console.error("Use at least 12 characters for the admin password.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
  scrypt(password, salt, 32, { N, r: R, p: P, maxmem: 128 * 1024 * 1024 }, (error, derived) =>
    error ? reject(error) : resolve(derived),
  ),
);

const hash = ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join(":");

console.log(`ADMIN_PASSWORD_HASH=${hash}`);

if (!process.argv.includes("--no-secret")) {
  console.log(`ADMIN_SESSION_SECRET=${randomBytes(48).toString("base64url")}`);
}
