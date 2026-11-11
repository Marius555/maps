"use client";

import dynamic from "next/dynamic";

/**
 * /for/wordpress's drawings, loaded in the browser only — for the reason the
 * landing page's step drawings are (steps/art/steps-art-loader.tsx): each map
 * in them stands on ~600 dots, which would be tens of kilobytes of circles in
 * the HTML for a picture nobody needs before the script runs. The 3:2 box
 * around each is its panel's, so nothing moves when one lands.
 *
 * The options are written out each time because Next reads them at build time
 * and accepts only an object literal.
 */
export const WordPressBlockArt = dynamic(() => import("./block-art"), { ssr: false });
export const InstallArt = dynamic(() => import("./install-art"), { ssr: false });
export const InsertArt = dynamic(() => import("./insert-art"), { ssr: false });
export const ConnectArt = dynamic(() => import("./connect-art"), { ssr: false });
export const ShortcodeArt = dynamic(() => import("./shortcode-art"), { ssr: false });
export const HtmlBlockArt = dynamic(() => import("./html-block-art"), { ssr: false });
