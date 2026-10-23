"use client";

import dynamic from "next/dynamic";

/**
 * The three step drawings, loaded in the browser only.
 *
 * `ssr: false` for the reason the showcase map has it (europe-map-loader.tsx):
 * each drawing stands on ~600 dots, and three of them in the HTML would be
 * tens of kilobytes of circles for a picture nobody needs before the script
 * runs. While a drawing's code arrives its box is simply the panel, empty —
 * the 3:2 box around it is `StepPanel`'s, so nothing moves when it lands.
 *
 * The options are written out each time because Next reads them at build time
 * and accepts only an object literal.
 */
export const ImportArt = dynamic(() => import("./import-art"), { ssr: false });
export const DesignArt = dynamic(() => import("./design-art"), { ssr: false });
export const PublishArt = dynamic(() => import("./publish-art"), { ssr: false });
