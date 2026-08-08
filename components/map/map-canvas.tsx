"use client";

import dynamic from "next/dynamic";

import { MapSkeleton } from "./map-skeleton";
import type { MapCanvasProps } from "./map-canvas-impl";

/**
 * This file exists only to own the `ssr: false` boundary.
 *
 * MapLibre touches `window` at module load, and in Next 16 `ssr: false` throws
 * if `dynamic()` is called from a Server Component — so the call has to live in
 * a "use client" module. map-canvas-impl is never imported anywhere else.
 */
const MapCanvasImpl = dynamic(() => import("./map-canvas-impl"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function MapCanvas(props: MapCanvasProps) {
  return <MapCanvasImpl {...props} />;
}
