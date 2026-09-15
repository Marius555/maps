/**
 * A v4 UUID that also exists outside a secure context.
 *
 * **The bug this exists for.** `crypto.randomUUID` is `[SecureContext]`-gated.
 * `http://localhost` is a trustworthy origin and has it; `http://192.168.1.212`
 * — the LAN address a phone reaches `next dev` on, and the one named in
 * `next.config.ts`'s `allowedDevOrigins` — is not, and there the property is
 * simply `undefined`.
 *
 * That would be a footnote if it were called somewhere a `try` could see it. It
 * is called to mint the optimistic row's temporary id inside a TanStack Query
 * `onMutate` (lib/query/places.ts, shapes.ts, groups.ts), and a throw in
 * `onMutate` means `mutationFn` never runs and the mutation reports failure. So
 * on a phone every pin drop and every shape draw failed before reaching the
 * network, and the raw `TypeError` fell through `resolveMessage` in
 * components/ui/error-message.tsx to **"Something broke on our side"** — a
 * sentence about a server that had not been asked anything.
 *
 * `crypto.getRandomValues` is *not* secure-context-gated and is there on the
 * same origin, so the fallback is the same sixteen random bytes with the version
 * and variant nibbles set by hand. The result is a real v4 UUID, not a
 * lookalike: nothing here parses one, but an id that is a UUID everywhere except
 * on a phone is a difference waiting to be depended on.
 *
 * `Math.random()` is the last resort and is reached only where `crypto` is
 * missing outright. It is not cryptographically random, which is acceptable for
 * the one job these ids have — telling this optimistic row from that one until
 * the server answers with a real id — and which is why this function must not
 * become the source of anything a security decision reads.
 *
 * Deliberately in /lib and not /packages/shared: the embed mints no ids, and
 * that directory is inherited by a bundle sitting 0.2KB under its ceiling
 * (CLAUDE.md §4).
 */

/** A v4 UUID, on any origin. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = randomBytes();

  // Version 4 in the high nibble of octet 6, variant 10x in octet 8 — what
  // `randomUUID` would have written, and what makes this parse as a v4.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);

    return bytes;
  }

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

/**
 * A short id for the things that only ever wanted eight characters — a tag, a
 * tag group, a custom field, a pin icon. They slice a UUID today; slicing it
 * here instead keeps the dashes out of the result by construction.
 */
export function newShortId(): string {
  return newId().replace(/-/g, "").slice(0, 8);
}
