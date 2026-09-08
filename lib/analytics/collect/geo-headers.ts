import "server-only";

/**
 * Where the visitor is, from whatever the host's edge chose to tell us.
 *
 * **Host-agnostic on purpose, because the host is not settled.** The app is
 * heading for Appwrite Sites, which documents no geo header at all; it could
 * move to Vercel, which documents four; and Cloudflare in front of either adds a
 * country for free. Reading a fixed set of headers in order and accepting
 * whatever answers means the origin map works on all three and none of this has
 * to be revisited when the answer changes.
 *
 * What it must never become is a lookup. An IP-geolocation call per beacon is a
 * metered request per visitor, which is the exact thing CLAUDE.md §2 exists to
 * forbid — and it is why a country with no coordinates is resolved from a static
 * table at read time (./country-centroids.ts) rather than from an API here.
 *
 * **Nothing is invented.** A field the headers did not carry comes back null and
 * is stored as null. A row that says it does not know where a visitor was is
 * worth more than one that quietly holds a country's midpoint and looks like a
 * measurement.
 */

export type VisitorGeo = {
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  ip: string | null;
};

/**
 * Which family of headers answered, logged once per process.
 *
 * Appwrite publishes nothing about what its edge forwards, so the honest way to
 * find out is to deploy and read this line. It is one `console.info` for the
 * life of the process, not per request, and it is the only thing standing
 * between "the origin map is empty" and a day of guessing why.
 */
let reported = false;

function report(source: string): void {
  if (reported) return;
  reported = true;
  console.info(`[analytics] visitor geo resolved from: ${source}`);
}

export function readVisitorGeo(headers: Headers): VisitorGeo {
  const ip = readIp(headers);

  // Vercel, which documents all four and sets them on every plan.
  const vercelCountry = clean(headers.get("x-vercel-ip-country"), 2);

  if (vercelCountry) {
    report("vercel");

    return {
      country: vercelCountry.toUpperCase(),
      // Vercel percent-encodes it, because a city name is not ASCII.
      city: decodeCity(headers.get("x-vercel-ip-city")),
      lat: readCoord(headers.get("x-vercel-ip-latitude"), 90),
      lng: readCoord(headers.get("x-vercel-ip-longitude"), 180),
      ip,
    };
  }

  // Cloudflare. The country is on the free plan; the coordinates are not, so
  // they are read optimistically and are usually absent.
  const cfCountry = clean(headers.get("cf-ipcountry"), 2);

  if (cfCountry) {
    report("cloudflare");

    return {
      // Cloudflare answers "XX" for an address it cannot place and "T1" for
      // Tor. Neither is a country and neither belongs on a map.
      country: /^[A-Z]{2}$/i.test(cfCountry) && !/^(XX|T1)$/i.test(cfCountry)
        ? cfCountry.toUpperCase()
        : null,
      city: clean(headers.get("cf-ipcity"), 64),
      lat: readCoord(headers.get("cf-iplatitude"), 90),
      lng: readCoord(headers.get("cf-iplongitude"), 180),
      ip,
    };
  }

  // Everything else, including Appwrite Sites as documented today: an address
  // and no geography. The session is still recorded; it is simply not on the
  // origin map.
  report(ip ? "ip only (no geo headers)" : "nothing");

  return { country: null, city: null, lat: null, lng: null, ip };
}

/**
 * The visitor's address.
 *
 * `x-appwrite-client-ip` first because Appwrite sets it deliberately and knows
 * which hop is real; `x-forwarded-for` is a client-settable header everywhere
 * else, and only the **first** entry is the original client — the rest are
 * proxies, and a trailing entry is trivially spoofed.
 *
 * Spoofability is worth being clear about: nothing here is a security control.
 * The address is evidence for an owner chasing abuse on their own map, and it is
 * exactly as trustworthy as the network in front of us.
 */
function readIp(headers: Headers): string | null {
  const direct = clean(headers.get("x-appwrite-client-ip"), 45);
  if (direct) return direct;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return clean(forwarded.split(",")[0], 45);

  return clean(headers.get("x-real-ip"), 45);
}

function clean(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed.slice(0, max) : null;
}

function decodeCity(value: string | null): string | null {
  const raw = clean(value, 96);
  if (!raw) return null;

  try {
    return decodeURIComponent(raw).slice(0, 64);
  } catch {
    // A malformed escape is not worth a 500. The undecoded name is still a name.
    return raw.slice(0, 64);
  }
}

function readCoord(value: string | null, bound: number): number | null {
  const parsed = Number(value);

  if (!value || !Number.isFinite(parsed)) return null;

  return Math.abs(parsed) <= bound ? parsed : null;
}
