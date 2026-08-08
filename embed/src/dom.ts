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
