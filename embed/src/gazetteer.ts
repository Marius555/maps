/**
 * Looking up a place name or postcode the visitor typed.
 *
 * The map's own search filters the snapshot's locations by text, which finds a
 * shop *called* Manchester and nothing else. This is the other half: a static
 * table of names to coordinates, fetched lazily from the CDN and cached by the
 * browser, so "SW1A" or "Köln" becomes a point to measure distances from.
 *
 * Geocoding the query would be a metered call in the visitor's path, which
 * CLAUDE.md §2 rules out and always will. A static file is the same thing the
 * snapshot already is: zero marginal cost, and nothing that can go down and take
 * search off every customer's site.
 *
 * The folding, keying and ranking live in /packages/shared — they are pure, and
 * two of them have a copy in scripts/build-gazetteer.mjs that only a test holds
 * them to. What stays here is everything that touches the network: fetching a
 * shard, caching it, and failing quietly when it is not there.
 *
 * Built by scripts/build-gazetteer.mjs from GeoNames (CC BY 4.0).
 */

import {
  fold,
  matchCodes,
  matchNames,
  postKey,
  shardOf,
  type GazetteerEntry,
  type GazetteerHit,
} from "@/packages/shared/gazetteer";
import type { SnapshotGazetteer } from "@/packages/shared/snapshot";

import { warn } from "./config";

export type { GazetteerHit };

/** Below this a prefix match is everything, and the list is noise. */
const MIN_QUERY = 2;
/** A search box is a shortlist, not a directory. */
const MAX_HITS = 6;

/**
 * Fetched shards, by URL, holding the *promise* rather than the result.
 *
 * Caching the promise is what makes four keystrokes in flight at once cost one
 * request instead of four. A failed fetch resolves to an empty array and stays
 * cached, so a missing shard is asked for once rather than on every character.
 */
const shards = new Map<string, Promise<GazetteerEntry[]>>();

export type Gazetteer = (query: string) => Promise<GazetteerHit[]>;

/**
 * A search function over the countries this map's locations are actually in.
 *
 * Returns a function that always resolves — never rejects. A search box that
 * throws on a 404 would take the whole control down over a file that is allowed
 * to be missing.
 */
export function createGazetteer(config: SnapshotGazetteer | undefined): Gazetteer {
  // No block means an older snapshot, or a map whose pins we know no country
  // for. Either way there is nothing to look up, and search stays exactly as it
  // was before this shipped.
  if (!config || config.countries.length === 0) return async () => [];

  return async (query: string): Promise<GazetteerHit[]> => {
    const folded = fold(query);
    if (folded.length < MIN_QUERY) return [];

    const code = postKey(query);
    const wanted: Promise<GazetteerHit[]>[] = [];

    for (const cc of config.countries) {
      wanted.push(
        load(`${config.base}/${cc}/cities.json`).then((entries) =>
          matchNames(entries, folded),
        ),
      );

      // A postcode shard is only worth asking for once the query could name one.
      // Cities and postcodes are searched together rather than guessed between:
      // "SW1" and "Sale" are both plausible openings and the visitor should not
      // have to tell us which kind of thing they are typing.
      if (code.length >= MIN_QUERY) {
        wanted.push(
          load(`${config.base}/${cc}/post/${shardOf(code)}.json`).then((entries) =>
            matchCodes(entries, code),
          ),
        );
      }
    }

    const hits = (await Promise.all(wanted)).flat();

    return hits.slice(0, MAX_HITS);
  };
}

async function load(url: string): Promise<GazetteerEntry[]> {
  const cached = shards.get(url);
  if (cached) return cached;

  const pending = fetch(url, { credentials: "omit" })
    .then((response) => {
      // A 404 is the likeliest failure by far — a base URL pointing at the wrong
      // origin, or a country nobody ran the build script for — and it resolves
      // rather than rejects, so it needs saying here or it says nothing at all.
      if (!response.ok) throw new Error(String(response.status));

      return response.json();
    })
    .then((value) => (Array.isArray(value) ? (value as GazetteerEntry[]) : []))
    .catch((error: unknown) => {
      // Once per URL, not per keystroke — the empty result is cached either way.
      // The console and nothing else: a stranger's site must never sprout our
      // diagnostics, and search carries on over the map's own locations.
      warn(
        `couldn't load place data from ${url} (${String(error)}). ` +
          "Search still covers the map's own locations.",
      );

      return [] as GazetteerEntry[];
    });

  shards.set(url, pending);

  return pending;
}
