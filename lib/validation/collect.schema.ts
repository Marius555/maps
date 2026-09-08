import { z } from "zod";

import { idSchema } from "./common";

/**
 * What a published map's embed posts about one visitor session.
 *
 * The other end is embed/src/track.ts, which caps everything before it sends.
 * **These limits are not those limits.** The embed's caps protect our bandwidth
 * from an honest page left open all day; these protect the database from a
 * hand-written POST, and the collector is the only route into this app that an
 * anonymous stranger can reach. Everything here is clamped rather than trusted,
 * and nothing about the payload's shape is taken on the client's word.
 *
 * The keys are one letter each because this travels on every visitor's session
 * and the names would be a third of the body. The mapping is the only thing this
 * file and the tracker have to agree on:
 *
 *   v  contract version   m  map id     s  session id
 *   h  page host          p  page path  r  referrer
 *   e  events
 *
 * There is deliberately no client timestamp. A session is dated from the
 * server's clock and the longest offset inside it, because a browser's clock can
 * be years out and a row dated from one lands in the wrong month.
 *
 * and inside an event: `t` its type, `o` milliseconds since the map booted, plus
 * whatever that type carries — `id`, `q`, `n`, `k`, `km`, `why`.
 */

/** Matches MAX_EVENTS in embed/src/track.ts. Kept here as the real ceiling. */
export const MAX_EVENTS = 60;

/**
 * The most body the collector will read, in bytes.
 *
 * Matches MAX_BODY in the tracker, and exists here for a different reason: the
 * tracker's cap stops *us* sending something silly, this one stops a stranger
 * making us parse it. Read before the JSON parser rather than after, because
 * the point is not to allocate a megabyte in order to reject it.
 */
export const MAX_BODY_BYTES = 8_192;

/** Matches MAX_STRING there. Long enough for a search phrase, short enough that
 * sixty of them cannot make a row worth worrying about. */
const MAX_VALUE = 80;

/**
 * A day in milliseconds.
 *
 * The offset ceiling, and it is generous on purpose: a map in a background tab
 * can legitimately sit for hours before its `pagehide` arrives. Anything beyond
 * a day is a clock that moved or a payload somebody wrote, and neither is a
 * session.
 */
const MAX_OFFSET_MS = 86_400_000;

/**
 * One interaction.
 *
 * `catchall` rather than a union of per-type shapes, and that is a deliberate
 * trade: a closed schema here would mean this file has to be edited in lockstep
 * with every new event the embed learns to send, and the two ship
 * independently — the embed lives on customers' pages and updates when they
 * reload, this updates when we deploy. An unknown key is stored and ignored; an
 * unknown *type* is counted under its own name and simply has no label in the
 * dashboard yet.
 */
/**
 * One interaction, sanitised.
 *
 * Spelled as a type rather than inferred from the schema because the `catchall`
 * widens every property to `string | number`, which would lose the two things
 * that are always known: what the event was, and when.
 */
export type CollectEvent = { t: string; o: number } & Record<string, string | number>;

const eventSchema = z
  .object({
    t: z.string().trim().min(1).max(32),
    o: z.number().int().min(0).max(MAX_OFFSET_MS).catch(0),
  })
  /*
   * `unknown`, not a union of the two types we want — and that is a correctness
   * decision rather than laziness.
   *
   * A union rejects, and rejection here is at the wrong granularity: `z.number()`
   * refuses Infinity and NaN, and `JSON.parse` turns both into `null` anyway, so
   * a single bad value in a single event would fail the whole payload and lose a
   * visitor's entire session. Accepting anything and dropping what we cannot use
   * in the transform below costs one bad *value* instead of forty good ones.
   */
  .catchall(z.unknown())
  .transform((event): CollectEvent => {
    const extra: Record<string, string | number> = {};

    for (const [key, value] of Object.entries(event)) {
      if (key === "t" || key === "o") continue;
      // Finite numbers and strings, and nothing else. A null, a boolean or a
      // nested object is something no version of the tracker sends, so it is
      // dropped rather than coerced into a shape it never had.
      if (typeof value === "number") {
        if (Number.isFinite(value)) extra[key] = value;
      } else if (typeof value === "string") {
        extra[key] = value.slice(0, MAX_VALUE);
      }
    }

    // The known two last, so a payload carrying its own `t` or `o` inside the
    // extras cannot overwrite the validated ones.
    return { ...extra, t: event.t, o: event.o };
  });

export const collectSchema = z.object({
  // A literal, not a range. A payload from a contract we do not know is one we
  // cannot read correctly, and guessing is how a field silently changes meaning.
  v: z.literal(1),
  m: idSchema,
  s: z.string().trim().min(1).max(64),
  /*
   * Where the map is embedded, and where the visitor came from before that.
   *
   * All three default to empty rather than being required: a referrer policy
   * can strip the third entirely, and an embed in a sandboxed frame can have
   * little to say about the first two. A session with no provenance is still a
   * session, and refusing it would quietly under-count exactly the strictest
   * sites.
   */
  h: z.string().max(255).catch("").default(""),
  p: z.string().max(2048).catch("").default(""),
  r: z.string().max(2048).catch("").default(""),
  e: z.array(eventSchema).min(1).max(MAX_EVENTS),
});

export type CollectInput = z.output<typeof collectSchema>;
