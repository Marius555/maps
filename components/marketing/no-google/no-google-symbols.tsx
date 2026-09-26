import { STROKE, SymbolFrame } from "../legend/legend-symbols";

/**
 * The No Google section's symbols, drawn in the key's box and inks: muted for
 * the thing, the accent for what it means for you.
 */

export function NoKeySymbol() {
  return (
    <SymbolFrame>
      <circle cx="10" cy="16" r="5.5" stroke="var(--muted)" {...STROKE} />
      <path d="M15.5 16H27M23 16v4M27 16v3" stroke="var(--muted)" {...STROKE} />
      <path d="M4 28L28 4" stroke="var(--accent)" {...STROKE} strokeWidth="2" />
    </SymbolFrame>
  );
}

export function NoMeterSymbol() {
  return (
    <SymbolFrame>
      <path d="M5 22a11 11 0 0 1 22 0" stroke="var(--muted)" {...STROKE} />
      <path d="M8 22h16" stroke="var(--accent)" {...STROKE} strokeWidth="2" />
      <circle cx="16" cy="22" r="2.5" fill="var(--accent)" />
    </SymbolFrame>
  );
}

export function NoTrackingSymbol() {
  return (
    <SymbolFrame>
      <path
        d="M3 16c3.5-5.5 8-8 13-8s9.5 2.5 13 8c-3.5 5.5-8 8-13 8s-9.5-2.5-13-8Z"
        stroke="var(--muted)"
        {...STROKE}
      />
      <circle cx="16" cy="16" r="3.5" fill="var(--muted)" opacity="0.8" />
      <path d="M5 27L27 5" stroke="var(--accent)" {...STROKE} strokeWidth="2" />
    </SymbolFrame>
  );
}

export function OwnDataSymbol() {
  return (
    <SymbolFrame>
      <rect x="4" y="5" width="18" height="22" rx="3" stroke="var(--muted)" {...STROKE} />
      <path d="M8 11h10M8 15h7M8 19h9" stroke="var(--muted)" {...STROKE} opacity="0.7" />
      <circle cx="24" cy="23" r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
      <path
        d="M21.8 23.2l1.6 1.6l3-3.2"
        stroke="var(--accent-foreground)"
        {...STROKE}
        strokeWidth="1.4"
      />
    </SymbolFrame>
  );
}
