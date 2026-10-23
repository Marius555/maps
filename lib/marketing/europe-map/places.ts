import type { HeroPinKind } from "../hero-map";

/**
 * The places the landing page's Europe map pins.
 *
 * The same coffee chain as the London hero (lib/marketing/hero-map.ts), with
 * its three kinds and their colours, grown into a chain with shops across
 * Europe. Every coordinate is the real city; the shops are invented.
 */

export type EuropePlace = {
  name: string;
  lng: number;
  lat: number;
  kind: HeroPinKind;
};

/** Europe, for the tilted plane. Route: Lisbon → Berlin. */
export const EUROPE_PLACES: readonly EuropePlace[] = [
  { name: "Lisbon", lng: -9.14, lat: 38.72, kind: "pickup" },
  { name: "Madrid", lng: -3.7, lat: 40.42, kind: "cafe" },
  { name: "Barcelona", lng: 2.17, lat: 41.39, kind: "cafe" },
  { name: "Paris", lng: 2.35, lat: 48.86, kind: "flagship" },
  { name: "London", lng: -0.12, lat: 51.5, kind: "flagship" },
  { name: "Dublin", lng: -6.26, lat: 53.35, kind: "cafe" },
  { name: "Amsterdam", lng: 4.9, lat: 52.37, kind: "cafe" },
  { name: "Berlin", lng: 13.4, lat: 52.52, kind: "flagship" },
  { name: "Copenhagen", lng: 12.57, lat: 55.68, kind: "pickup" },
  { name: "Stockholm", lng: 18.07, lat: 59.33, kind: "cafe" },
  { name: "Vilnius", lng: 25.28, lat: 54.69, kind: "cafe" },
  { name: "Warsaw", lng: 21.01, lat: 52.23, kind: "pickup" },
  { name: "Prague", lng: 14.42, lat: 50.08, kind: "cafe" },
  { name: "Vienna", lng: 16.37, lat: 48.21, kind: "cafe" },
  { name: "Milan", lng: 9.19, lat: 45.46, kind: "pickup" },
  { name: "Rome", lng: 12.5, lat: 41.9, kind: "flagship" },
  { name: "Athens", lng: 23.73, lat: 37.98, kind: "cafe" },
  { name: "Zurich", lng: 8.54, lat: 47.37, kind: "cafe" },
];

/** The road the tilted plane draws, in order. */
export const EUROPE_ROUTE: readonly string[] = [
  "Lisbon",
  "Madrid",
  "Barcelona",
  "Milan",
  "Zurich",
  "Prague",
  "Berlin",
];

/** Looks a place up by name; the lists above are written so this never misses. */
export function placeNamed(
  places: readonly EuropePlace[],
  name: string,
): EuropePlace {
  const place = places.find((p) => p.name === name);
  if (!place) throw new Error(`No Europe map place named ${name}`);
  return place;
}
