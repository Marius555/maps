import { ImageResponse } from "next/og";

import { PRODUCT_NAME } from "@/lib/config";

/**
 * The card this page shares as.
 *
 * Without one, every link to the product anywhere — a Slack message, a tweet,
 * a WhatsApp to a colleague — is a bare grey URL, which is a strange thing for
 * a page whose whole argument is that it looks good.
 *
 * Drawn here rather than shipped as a PNG, because it is mostly words: a file
 * would go stale the first time the wording changed.
 *
 * Satori, which renders this, is **not a browser**: flexbox only, no CSS
 * variables, no `gap` shorthand surprises, and colours must be literal. So the
 * three values below are the theme's own tokens written out in hex — the one
 * place in this codebase where that is correct rather than a shortcut.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${PRODUCT_NAME} — a store locator for your own site`;

const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const GROUND = "#f7f7f7";
const ACCENT = "#f54600";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: GROUND,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              background: ACCENT,
              border: `5px solid ${GROUND}`,
              boxShadow: `0 0 0 2px ${ACCENT}`,
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 600, color: INK }}>
            {PRODUCT_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.02,
              color: INK,
            }}
          >
            All your locations,
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.02,
              color: INK,
            }}
          >
            on your own site.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", height: 4, background: ACCENT, width: 132 }} />
          <div style={{ fontSize: 30, color: MUTED }}>
            Import a spreadsheet, paste one line of code. Unlimited views.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
