"use client";

import dynamic from "next/dynamic";

/** `SyncScene`, browser only, for the reason every stage drawing is (wordpress-art-loader.tsx). */
export const SyncScene = dynamic(() => import("./sync-scene"), { ssr: false });
