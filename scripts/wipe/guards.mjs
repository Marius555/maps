/**
 * What stands between `--execute` and an empty database. Each guard exits the
 * process on failure, naming what was missing, and none of them can be
 * answered by a flag: they want a person at a terminal who knows the admin
 * password and types the project id.
 *
 * The scrypt check mirrors lib/admin/auth/password.ts — same
 * `scrypt:N:r:p:salt:hash` format, made by `npm run admin:hash`. Change one,
 * change the other.
 */

import { scrypt, timingSafeEqual } from "node:crypto";
import { createInterface } from "node:readline";

/** A pipe, a CI runner or an agent has no terminal, and gets no wipe. */
export function requireTerminal() {
  if (process.env.CI) {
    fail("Refusing to run in CI. Run it yourself, from your own terminal.");
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail("This needs a terminal to ask for the admin password. Run it yourself, not through a pipe.");
  }
}

export async function requireAdminPassword() {
  const stored = process.env.ADMIN_PASSWORD_HASH ?? "";

  if (!stored) {
    fail(
      "ADMIN_PASSWORD_HASH is not set in .env, so there is no password to check.\n" +
        "Run npm run admin:hash and put the line it prints into .env.",
    );
  }

  const password = await askHidden("Admin password: ");

  if (!(await verifyPassword(password, stored))) {
    fail("Wrong password. Nothing was deleted.");
  }
}

export async function requireConfirmation(projectId) {
  const phrase = `${projectId} WIPE`;

  console.log(`\nTo delete everything listed above, type exactly:\n\n  ${phrase}\n`);
  const answer = await ask("> ");

  if (answer.trim() !== phrase) {
    fail("That did not match. Nothing was deleted.");
  }
}

export async function countdown(seconds) {
  for (let left = seconds; left > 0; left -= 1) {
    process.stdout.write(`\rDeleting in ${left}s — press Ctrl+C to stop. `);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  process.stdout.write("\n\n");
}

export function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** Reads a line with nothing echoed, so the password never sits on screen. */
function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    let value = "";

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          // Ctrl+C — raw mode swallows the signal, so honour it by hand.
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }

        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };

    stdin.on("data", onData);
  });
}

async function verifyPassword(plain, stored) {
  const parts = stored.trim().split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [N, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], "base64url");
  const key = Buffer.from(parts[5], "base64url");

  try {
    const candidate = await new Promise((resolve, reject) =>
      scrypt(plain, salt, key.length, { N, r, p, maxmem: 128 * 1024 * 1024 }, (error, derived) =>
        error ? reject(error) : resolve(derived),
      ),
    );

    return candidate.length === key.length && timingSafeEqual(candidate, key);
  } catch {
    return false;
  }
}
