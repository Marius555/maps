import { BRAND, isExternalLink, type Brand } from "@/lib/brand";

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
 *
 * The name, logo and footer come from brand.json. `brand` is a parameter only so
 * the tests can pass their own; every real caller takes the default.
 *
 * The shape: the logo on the grey canvas, a white card under it with an accent
 * bar across its top edge, the button, and the raw link last under a rule —
 * it is the fallback, so it reads as one.
 */

/** The theme's accent, `oklch(64.37% 0.2195 36.18)`, in the one notation email understands. */
const ACCENT = "#e8572a";
const INK = "#2e2e2e";
const MUTED = "#767676";
const BORDER = "#e9e9e9";
const CANVAS = "#f7f7f7";
/**
 * Set on every text element, not inherited: Outlook resets the font inside each
 * table cell, and with no family at all a client falls back to Times.
 */
const FONT =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

/**
 * Image formats every mail client draws. SVG is not one — Gmail and Outlook both
 * drop it — so an SVG logo, or a URL with no extension to judge by, sends the
 * name as text instead of an empty box.
 */
const EMAIL_IMAGE = /\.(png|jpe?g|gif)$/i;

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
        `<p style="${FONT}margin:0 0 16px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(line)}</p>`,
    )
    .join("");
}

/**
 * The origin a brand.json path (`/brand/logo.png`, `/privacy`) is resolved
 * against, taken from the button's own link.
 *
 * Every button is built from `env.appUrl` — the configured origin, never a
 * request's `Host` header (see lib/env.ts) — so this is that value, without this
 * module having to import the server's environment and needing an `.env` to be
 * tested. No button means no origin, and a path is then left out rather than
 * sent relative: a relative href in an email goes nowhere.
 */
function originOf(cta: EmailCta | undefined): string | undefined {
  if (!cta) return undefined;

  try {
    return new URL(cta.url).origin;
  } catch {
    return undefined;
  }
}

function resolveLink(
  href: string | undefined,
  origin: string | undefined,
): string | undefined {
  if (!href) return undefined;
  if (isExternalLink(href)) return href;
  return origin ? new URL(href, origin).toString() : undefined;
}

/**
 * `logo.email` first: it exists because the site's own logo is an SVG, which
 * no mail client draws. Only `height` is given as an attribute — the width is
 * the image's own business, and a fixed one would squash the next logo.
 */
function header(brand: Brand, origin: string | undefined): string {
  const logo = resolveLink(brand.logo.email ?? brand.logo.light, origin);

  if (logo && EMAIL_IMAGE.test(new URL(logo).pathname)) {
    return `<img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.logo.alt ?? brand.name)}" height="32" style="display:block;height:32px;width:auto;max-width:220px;border:0;" />`;
  }

  return `<p style="${FONT}margin:0;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${INK};">${escapeHtml(brand.name)}</p>`;
}

type Footer = {
  holder: string;
  supportEmail?: string;
  privacyUrl?: string;
};

/**
 * The product name, not `brand.company.*`: the service is run as an
 * individuali veikla, those fields are a person's name and certificate number,
 * and the owner keeps them on the legal pages only (`documents/company.md`).
 */
function footer(brand: Brand, origin: string | undefined): Footer {
  return {
    holder: brand.name,
    supportEmail: brand.contact.supportEmail,
    privacyUrl: resolveLink(brand.legal.privacyUrl, origin),
  };
}

function footerHtml({ holder, supportEmail, privacyUrl }: Footer): string {
  const links = [
    supportEmail
      ? `<a href="mailto:${escapeHtml(supportEmail)}" style="${FONT}color:${MUTED};">${escapeHtml(supportEmail)}</a>`
      : "",
    privacyUrl
      ? `<a href="${escapeHtml(privacyUrl)}" style="${FONT}color:${MUTED};">Privacy policy</a>`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const lines = [escapeHtml(holder), links].filter(Boolean);

  return `<p style="${FONT}margin:24px 0 0;font-size:12px;line-height:1.6;text-align:center;color:${MUTED};">${lines.join("<br />")}</p>`;
}

export function emailShell(
  { title, intro, cta, outro }: EmailShellInput,
  brand: Brand = BRAND,
): string {
  const origin = originOf(cta);

  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;">
         <tr><td style="border-radius:10px;background:${ACCENT};">
           <a href="${escapeHtml(cta.url)}"
              style="${FONT}display:inline-block;padding:14px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(cta.label)}</a>
         </td></tr>
       </table>`
    : "";

  // The raw URL under the button: a link that cannot be copied out is a dead end
  // for every client that strips anchors, and for anyone reading in plain text.
  const fallback = cta
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
         <tr><td style="border-top:1px solid ${BORDER};padding-top:20px;">
           <p style="${FONT}margin:0 0 6px;font-size:12px;line-height:1.6;color:${MUTED};">Button not working? Paste this into your browser:</p>
           <p style="${FONT}margin:0;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(cta.url)}" style="${FONT}color:${ACCENT};">${escapeHtml(cta.url)}</a></p>
         </td></tr>
       </table>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="${FONT}margin:0;padding:0;background:${CANVAS};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CANVAS};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 4px 20px;">${header(brand, origin)}</td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid ${BORDER};border-top:4px solid ${ACCENT};border-radius:14px;">
                  <tr>
                    <td style="padding:36px 36px 12px;">
                      <h1 style="${FONT}margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-0.02em;color:${INK};">${escapeHtml(title)}</h1>
                      ${paragraphs(intro)}
                      ${button}
                      ${outro ? paragraphs(outro) : ""}
                      ${fallback}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>${footerHtml(footer(brand, origin))}</td>
            </tr>
          </table>
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
export function emailText(
  { title, intro, cta, outro }: EmailShellInput,
  brand: Brand = BRAND,
): string {
  const { supportEmail, privacyUrl } = footer(brand, originOf(cta));

  return [
    title,
    "",
    ...intro,
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    ...(outro ? ["", ...outro] : []),
    "",
    `— ${brand.name}`,
    ...(supportEmail ? [supportEmail] : []),
    ...(privacyUrl ? [`Privacy policy: ${privacyUrl}`] : []),
  ].join("\n");
}
