"use client";

import { Globe, Mail, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Place } from "@/lib/repositories/types";

/**
 * Description and the ways to reach a location.
 *
 * The address is not here. It is the card's heading (place-card-header.tsx), and
 * printing it again two lines below was the same string twice on a 256px card.
 *
 * Contact rows are links, not text: a phone number on a card you are looking at
 * while standing outside the shop should be tappable. `tel:` and `mailto:` are
 * safe schemes by construction here — unlike the website, which is customer input
 * and gets its scheme checked.
 */
export function PlaceCardDetails({ place }: { place: Place }) {
  const website = safeHttpUrl(place.url);

  // Nothing at all, rather than an empty box: the parent spaces its children, so
  // a location with only hours would otherwise get a gap above them.
  if (!place.description && !place.phone && !place.email && !website) return null;

  return (
    <div className="space-y-2">
      {place.description ? (
        <p className="text-xs whitespace-pre-line text-foreground">
          {place.description}
        </p>
      ) : null}

      {place.phone || place.email || website ? (
        <ul className="space-y-1">
          {place.phone ? (
            <ContactRow
              icon={Phone}
              label={place.phone}
              href={`tel:${place.phone}`}
            />
          ) : null}

          {place.email ? (
            <ContactRow
              icon={Mail}
              label={place.email}
              href={`mailto:${place.email}`}
            />
          ) : null}

          {website ? (
            <ContactRow
              icon={Globe}
              label={website.host + website.pathname.replace(/\/$/, "")}
              href={website.href}
            />
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  href,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
}) {
  return (
    <li>
      <a
        href={href}
        // A location's website is a third party's, and this card is inside our
        // dashboard — no reaching back through window.opener.
        rel="noopener noreferrer"
        target="_blank"
        className="flex min-w-0 items-center gap-1.5 text-xs text-foreground underline-offset-2 hover:underline"
      >
        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
        <span className="truncate">{label}</span>
      </a>
    </li>
  );
}

/**
 * `url` is stored after a validation that accepts any parseable URL, which
 * includes `javascript:`. Rendering it as a link would be handing a click to
 * whatever was typed, so anything that is not http(s) is dropped.
 */
function safeHttpUrl(value: string | null): URL | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
