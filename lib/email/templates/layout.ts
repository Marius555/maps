import { PRODUCT_NAME } from "@/lib/config";

/**
 * One skeleton, shared by every message we send.
 *
 * **Colours are hardcoded literals here, and only here.** The rest of the app
 * restyles by editing oklch variables in app/globals.css (CLAUDE.md), which is
 * exactly what an email client will not do for us: Gmail strips `<style>`, no
 * client resolves `var()`, and `oklch()` is younger than most of the renderers
 * this has to survive. So the palette below is the theme's own values converted
 * to sRGB hex and inlined on every element. If the accent changes, this file is
 * the second place to change it.
 *
 * A table for the button for the same reason — Outlook's Word renderer ignores
 * padding on an anchor, and a link with no visible box reads as a broken email.
 *
 * Light only. `prefers-color-scheme` support across clients is too partial to
 * carry a second palette, and a light card is legible in a dark client while the
 * reverse is not.
 */

/** The theme's accent, `oklch(64.37% 0.2195 36.18)`, in the one notation email understands. */
const ACCENT = "#e8572a";
const INK = "#2e2e2e";
const MUTED = "#767676";
const BORDER = "#e9e9e9";
const CANVAS = "#f7f7f7";

export type EmailCta = { label: string; url: string };

export type EmailShellInput = {
  /** The <h1>, and the first thing read in the preview pane. */
  title: string;
  /** One or two sentences before the button. */
  intro: string[];
  cta?: EmailCta;
  /** What to do if the button does not work, or why this arrived. */
  outro?: string[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(lines: string[]): string {
  return lines
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(line)}</p>`,
    )
    .join("");
}

export function emailShell({ title, intro, cta, outro }: EmailShellInput): string {
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
         <tr><td style="border-radius:8px;background:${ACCENT};">
           <a href="${escapeHtml(cta.url)}"
              style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
         </td></tr>
       </table>`
    : "";

  // The raw URL under the button: a link that cannot be copied out is a dead end
  // for every client that strips anchors, and for anyone reading in plain text.
  const fallback = cta
    ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${MUTED};">Or paste this into your browser:</p>
       <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(cta.url)}" style="color:${ACCENT};">${escapeHtml(cta.url)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${CANVAS};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:-0.01em;color:${INK};">${escapeHtml(PRODUCT_NAME)}</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;color:${INK};">${escapeHtml(title)}</h1>
                ${paragraphs(intro)}
                ${button}
                ${fallback}
                ${outro ? paragraphs(outro) : ""}
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(PRODUCT_NAME)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * The same message as words.
 *
 * Not a nicety: a message with no `text/plain` part scores as spam with most
 * filters, and the link has to survive in it or the fallback is not one.
 */
export function emailText({ title, intro, cta, outro }: EmailShellInput): string {
  return [
    title,
    "",
    ...intro,
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    ...(outro ? ["", ...outro] : []),
    "",
    `— ${PRODUCT_NAME}`,
  ].join("\n");
}
