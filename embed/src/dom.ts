/**
 * Element helpers.
 *
 * Everything here sets text through `textContent`, never `innerHTML`. Place
 * names, addresses and descriptions are customer-authored text being injected
 * into a third party's page — building nodes rather than concatenating HTML is
 * what keeps that from being an XSS hole, and it means no escaping helper can be
 * forgotten at a call site.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text) node.textContent = text;

  return node;
}

export function button(className: string, label: string): HTMLButtonElement {
  const node = el("button", className, label);
  // Inside a customer's <form> an unspecified button submits the page.
  node.type = "button";

  return node;
}

/**
 * A line-drawn glyph, for the controls that are too small to hold a word.
 *
 * `createElementNS`, because SVG is not HTML: `createElement("svg")` produces an
 * HTMLUnknownElement that renders nothing at all, silently. And built as nodes
 * rather than assigned as markup, on the same rule as everything else in this
 * file — the embed sets no `innerHTML` anywhere, so there is no habit to lapse
 * from when a string does eventually carry customer text.
 *
 * `stroke="currentColor"` so a glyph inherits the button's colour and follows
 * the dark theme with no second rule.
 *
 * 1.5 rather than lucide's own 2, because these sit at 18px inside a small
 * control: at that size a 2-unit stroke reads as a heavy blob rather than a
 * line drawing, and next to the search field's own hairline border it was the
 * loudest thing in the panel.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

export function icon(paths: string[], strokeWidth = 1.5): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");

  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", String(strokeWidth));
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  // The button carries the accessible name; the drawing is decoration.
  svg.setAttribute("aria-hidden", "true");

  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }

  return svg;
}

/** Schemes a place's link is allowed to use. */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * A link built from customer-supplied data.
 *
 * The scheme is checked because a place's `url` is stored after a validation
 * that accepts any parseable URL — `javascript:...` included. That is harmless
 * on the owner's own site and not harmless on a page that merely embeds their
 * map, so anything outside the safe set produces plain text instead of a link.
 *
 * `noopener` stops the target reaching back through `window.opener`.
 */
export function link(
  className: string,
  label: string,
  href: string,
): HTMLElement {
  if (!isSafeHref(href)) return el("span", className, label);

  const node = el("a", className, label);
  node.href = href;
  node.rel = "noopener noreferrer";
  node.target = "_blank";

  return node;
}

function isSafeHref(href: string): boolean {
  try {
    return SAFE_SCHEMES.has(new URL(href, window.location.href).protocol);
  } catch {
    return false;
  }
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}
