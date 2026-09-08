/**
 * Roughly where a country is, so a country code can be drawn on a map.
 *
 * The origin heatmap needs coordinates, and the only geo fact a host is
 * guaranteed to give us is a two-letter country code — Appwrite documents no geo
 * header at all, and Cloudflare's free plan gives the country and nothing else.
 * A lookup table turns that code into something drawable at **no per-request
 * cost and with no third-party call**, which is the whole reason it is a table
 * and not an API: an IP-geolocation request per beacon is exactly the metered
 * call in a visitor's path that CLAUDE.md §2 forbids.
 *
 * **These are approximate visual centroids, not geodetic ones.** They exist to
 * put a blob inside the right landmass on a world map. The heatmap this feeds
 * fades out by zoom 11.5 (components/analytics/heat-layers.ts), so a value that
 * is a degree off is invisible; a value in the wrong country is not, and that is
 * the only accuracy that matters here. A country whose real traffic is nowhere
 * near its geographic middle — Russia, Canada, Australia — is still drawn at its
 * middle rather than at its population centre, because guessing where a
 * customer's visitors live inside a country is a fiction the data does not
 * support.
 *
 * An unknown code answers `null` and the session is simply not on the origin
 * map. It is still on every other part of the page.
 *
 * Client-safe on purpose: the dashboard resolves these when it builds the map's
 * points, so nothing here may import `server-only`.
 */
const CENTROIDS: Record<string, readonly [number, number]> = {
  /* Europe */
  AD: [1.5, 42.5], AL: [20.0, 41.0], AT: [14.5, 47.6], AX: [20.0, 60.2],
  BA: [17.8, 44.0], BE: [4.5, 50.6], BG: [25.5, 42.7], BY: [28.0, 53.7],
  CH: [8.2, 46.8], CY: [33.2, 35.0], CZ: [15.5, 49.8], DE: [10.4, 51.1],
  DK: [9.5, 56.0], EE: [25.8, 58.7], ES: [-3.7, 40.2], FI: [26.0, 64.0],
  FO: [-6.9, 62.0], FR: [2.4, 46.6], GB: [-2.0, 54.0], GG: [-2.58, 49.46],
  GI: [-5.35, 36.14], GR: [22.5, 39.0], HR: [16.4, 45.2], HU: [19.5, 47.2],
  IE: [-8.0, 53.2], IM: [-4.55, 54.24], IS: [-19.0, 64.9], IT: [12.6, 42.8],
  JE: [-2.13, 49.21], LI: [9.55, 47.15], LT: [23.9, 55.2], LU: [6.1, 49.8],
  LV: [24.9, 56.9], MC: [7.42, 43.74], MD: [28.5, 47.2], ME: [19.3, 42.8],
  MK: [21.7, 41.6], MT: [14.4, 35.9], NL: [5.4, 52.2], NO: [12.0, 64.5],
  PL: [19.4, 52.1], PT: [-8.2, 39.6], RO: [25.0, 45.9], RS: [20.8, 44.0],
  RU: [90.0, 61.0], SE: [15.5, 62.0], SI: [14.8, 46.1], SK: [19.5, 48.7],
  SM: [12.46, 43.94], UA: [31.2, 49.0], VA: [12.45, 41.9], XK: [20.9, 42.6],

  /* North and Central America, Caribbean */
  AG: [-61.79, 17.06], AI: [-63.07, 18.22], AW: [-69.97, 12.52],
  BB: [-59.6, 13.2], BM: [-64.75, 32.32], BS: [-77.4, 24.9], BZ: [-88.5, 17.2],
  CA: [-106.3, 56.1], CR: [-84.1, 9.9], CU: [-77.8, 21.5], CW: [-68.99, 12.17],
  DM: [-61.37, 15.41], DO: [-70.2, 18.7], GD: [-61.68, 12.12],
  GL: [-42.6, 71.7], GP: [-61.55, 16.27], GT: [-90.2, 15.7], HN: [-86.5, 14.8],
  HT: [-72.3, 19.0], JM: [-77.3, 18.1], KN: [-62.78, 17.36], KY: [-80.57, 19.31],
  LC: [-60.98, 13.91], MQ: [-61.02, 14.64], MX: [-102.5, 23.6],
  NI: [-85.2, 12.9], PA: [-80.1, 8.5], PM: [-56.3, 46.9], PR: [-66.5, 18.2],
  SV: [-88.9, 13.8], TC: [-71.8, 21.7], TT: [-61.2, 10.7], US: [-98.0, 39.5],
  VC: [-61.29, 13.25], VG: [-64.6, 18.42], VI: [-64.9, 18.34],

  /* South America */
  AR: [-64.0, -35.4], BO: [-64.7, -16.3], BR: [-51.9, -14.2], CL: [-71.5, -35.7],
  CO: [-74.3, 4.6], EC: [-78.2, -1.5], FK: [-59.5, -51.8], GF: [-53.13, 3.93],
  GY: [-58.9, 4.9], PE: [-75.0, -9.2], PY: [-58.4, -23.4], SR: [-56.0, 4.0],
  UY: [-55.8, -32.5], VE: [-66.6, 6.4],

  /* Africa */
  AO: [17.9, -11.2], BF: [-1.6, 12.2], BI: [29.9, -3.4], BJ: [2.3, 9.3],
  BW: [24.7, -22.3], CD: [23.6, -4.0], CF: [20.9, 6.6], CG: [15.8, -0.2],
  CI: [-5.5, 7.5], CM: [12.4, 7.4], CV: [-24.0, 16.0], DJ: [42.6, 11.8],
  DZ: [2.6, 28.0], EG: [30.8, 26.8], ER: [39.8, 15.2], ET: [40.5, 9.1],
  GA: [11.6, -0.8], GH: [-1.0, 7.9], GM: [-15.3, 13.4], GN: [-9.7, 9.9],
  GQ: [10.3, 1.6], GW: [-15.2, 11.8], KE: [37.9, 0.0], KM: [43.9, -11.6],
  LR: [-9.4, 6.4], LS: [28.2, -29.6], LY: [17.2, 26.3], MA: [-7.1, 31.8],
  MG: [46.9, -18.8], ML: [-4.0, 17.6], MR: [-10.9, 21.0], MU: [57.6, -20.3],
  MW: [34.3, -13.3], MZ: [35.5, -18.7], NA: [18.5, -22.9], NE: [8.1, 17.6],
  NG: [8.7, 9.1], RE: [55.54, -21.12], RW: [29.9, -1.9], SC: [55.5, -4.7],
  SD: [30.2, 12.9], SL: [-11.8, 8.5], SN: [-14.5, 14.5], SO: [46.2, 5.2],
  SS: [31.3, 6.9], ST: [6.6, 0.2], SZ: [31.5, -26.5], TD: [19.0, 15.5],
  TG: [0.8, 8.6], TN: [9.5, 33.9], TZ: [34.9, -6.4], UG: [32.3, 1.4],
  YT: [45.17, -12.83], ZA: [22.9, -30.6], ZM: [27.8, -13.1], ZW: [29.2, -19.0],

  /* Asia and the Middle East */
  AE: [53.85, 23.4], AF: [67.7, 33.9], AM: [45.0, 40.1], AZ: [47.6, 40.1],
  BD: [90.4, 23.7], BH: [50.6, 26.0], BN: [114.7, 4.5], BT: [90.4, 27.5],
  CN: [104.2, 35.9], GE: [43.4, 42.2], HK: [114.1, 22.4], ID: [113.9, -0.8],
  IL: [34.9, 31.05], IN: [78.9, 20.6], IQ: [43.7, 33.2], IR: [53.7, 32.4],
  JO: [36.2, 30.6], JP: [138.3, 36.2], KG: [74.8, 41.2], KH: [104.9, 12.6],
  KP: [127.5, 40.3], KR: [127.8, 35.9], KW: [47.5, 29.3], KZ: [66.9, 48.0],
  LA: [102.5, 19.9], LB: [35.9, 33.9], LK: [80.8, 7.9], MM: [96.0, 21.9],
  MN: [103.8, 46.9], MO: [113.5, 22.2], MV: [73.2, 3.2], MY: [101.98, 4.2],
  NP: [84.1, 28.4], OM: [55.9, 21.5], PH: [121.8, 12.9], PK: [69.3, 30.4],
  PS: [35.2, 31.95], QA: [51.2, 25.4], SA: [45.1, 23.9], SG: [103.82, 1.35],
  SY: [39.0, 34.8], TH: [100.99, 15.9], TJ: [71.3, 38.9], TL: [125.7, -8.9],
  TM: [59.6, 38.97], TR: [35.2, 38.96], TW: [121.0, 23.7], UZ: [64.6, 41.4],
  VN: [108.3, 14.06], YE: [48.5, 15.55],

  /* Oceania */
  AS: [-170.7, -14.3], AU: [133.8, -25.3], CK: [-159.78, -21.24],
  FJ: [178.0, -17.7], FM: [150.5, 7.4], GU: [144.79, 13.44], KI: [-157.4, 1.87],
  MH: [171.2, 7.1], MP: [145.7, 15.1], NC: [165.6, -20.9], NF: [167.95, -29.04],
  NR: [166.93, -0.52], NU: [-169.87, -19.05], NZ: [174.9, -40.9],
  PF: [-149.4, -17.7], PG: [143.96, -6.3], PW: [134.6, 7.5], SB: [160.2, -9.6],
  TK: [-171.85, -9.2], TO: [-175.2, -21.2], TV: [179.2, -7.11],
  VU: [166.96, -15.4], WF: [-177.16, -13.77], WS: [-172.1, -13.76],
};

/** `[lng, lat]` for an ISO 3166-1 alpha-2 code, or null for one we don't hold. */
export function countryCentroid(
  code: string | null | undefined,
): readonly [number, number] | null {
  if (!code) return null;

  return CENTROIDS[code.trim().toUpperCase()] ?? null;
}
