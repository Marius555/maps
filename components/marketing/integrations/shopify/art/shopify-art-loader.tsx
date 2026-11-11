"use client";

import dynamic from "next/dynamic";

/**
 * /for/shopify's drawings, loaded in the browser only — for the reason every
 * stage drawing is (../../wordpress/art/wordpress-art-loader.tsx). The options
 * are written out each time because Next reads them at build time.
 */
export const ThemeEditorArt = dynamic(() => import("./theme-editor-art"), { ssr: false });
export const InstallAppArt = dynamic(() => import("./install-app-art"), { ssr: false });
export const ImportLocationsArt = dynamic(() => import("./import-locations-art"), { ssr: false });
export const AddToThemeArt = dynamic(() => import("./add-to-theme-art"), { ssr: false });
