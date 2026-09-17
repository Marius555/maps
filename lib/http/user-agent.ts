import { BRAND } from "@/lib/brand";

/**
 * The User-Agent every outbound call to a geocoding or routing service sends.
 *
 * Public OSM-derived services block unidentified clients, and their usage
 * policies ask for a way to reach whoever is calling — so the product's name
 * and site go first, both from brand.json, and a rename there renames this too.
 * `purpose` says what the calls are for, which is what an operator deciding
 * whether to block us actually wants to know.
 */
export function serviceUserAgent(purpose: string): string {
  const contact = BRAND.website ? `+${BRAND.website}; ` : "";
  return `${BRAND.name}/1.0 (${contact}embeddable store locator; ${purpose})`;
}
