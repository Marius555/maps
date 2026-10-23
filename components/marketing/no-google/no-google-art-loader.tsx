"use client";

import dynamic from "next/dynamic";

/**
 * The Sources drawing, loaded in the browser only — for the reason the step
 * drawings are (steps/art/steps-art-loader.tsx): it stands on ~600 dots, which
 * would be tens of kilobytes of circles in the HTML for a picture nobody needs
 * before the script runs. The 3:2 box around it is `SplitBody`'s, so nothing
 * moves when it lands.
 */
export const NoGoogleArt = dynamic(() => import("./no-google-art"), { ssr: false });
