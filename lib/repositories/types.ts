import type { Models } from "node-appwrite";

import type { MapStyleKey } from "@/lib/map/style";
import type { GeocodeStatus } from "@/lib/validation/place.schema";

/**
 * Raw Appwrite row shapes. These stay inside /lib/repositories.
 *
 * Optional columns are declared optional, not just nullable: the SDK derives the
 * `data` argument of createRow from this type, so a required-but-empty field
 * would force every insert to spell out columns it has nothing to say about.
 */
export type MapRow = Models.Row & {
  userId: string;
  name: string;
  slug: string;
  style: string;
  defaultLat: number;
  defaultLng: number;
  defaultZoom: number;
  categories?: string | null;
  settings?: string | null;
  allowedDomains?: string[] | null;
  publishedAt?: string | null;
  snapshotUrl?: string | null;
};

export type PlaceRow = Models.Row & {
  mapId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  category?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  url?: string | null;
  hours?: string | null;
  photoId?: string | null;
  sortOrder?: number | null;
  geocodeConfidence?: number | null;
  geocodeStatus?: string | null;
};

/** Domain shapes. Everything outside /lib/repositories sees only these. */
export type MapCategory = {
  id: string;
  label: string;
  color: string;
};

export type AppMap = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  style: MapStyleKey;
  defaultLat: number;
  defaultLng: number;
  defaultZoom: number;
  categories: MapCategory[];
  settings: Record<string, unknown>;
  allowedDomains: string[];
  publishedAt: string | null;
  snapshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Place = {
  id: string;
  mapId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  category: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  photoId: string | null;
  /**
   * Resolved from photoId on the server. Clients render this directly rather than
   * composing a storage URL, which keeps the bucket id server-side.
   */
  photoUrl: string | null;
  sortOrder: number;
  geocodeConfidence: number | null;
  geocodeStatus: GeocodeStatus;
  createdAt: string;
  updatedAt: string;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  total: number;
};
