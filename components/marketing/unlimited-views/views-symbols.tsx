import { STROKE, SymbolFrame } from "../legend/legend-symbols";

/** The Unlimited views section's symbols, in the key's box and inks. */

export function PublishedFileSymbol() {
  return (
    <SymbolFrame>
      <path d="M8 4h11l6 6v18H8Z" stroke="var(--muted)" {...STROKE} />
      <path d="M19 4v6h6" stroke="var(--muted)" {...STROKE} />
      <path d="M12 16h9M12 20h6" stroke="var(--accent)" {...STROKE} strokeWidth="2" />
    </SymbolFrame>
  );
}

export function NoServerSymbol() {
  return (
    <SymbolFrame>
      <rect x="6" y="5" width="20" height="9" rx="2.5" stroke="var(--muted)" {...STROKE} />
      <rect x="6" y="18" width="20" height="9" rx="2.5" stroke="var(--muted)" {...STROKE} />
      <circle cx="10.5" cy="9.5" r="1.3" fill="var(--muted)" />
      <circle cx="10.5" cy="22.5" r="1.3" fill="var(--muted)" />
      <path d="M4 28L28 4" stroke="var(--accent)" {...STROKE} strokeWidth="2" />
    </SymbolFrame>
  );
}

export function FlatLineSymbol() {
  return (
    <SymbolFrame>
      <path d="M4 4v24h24" stroke="var(--muted)" {...STROKE} />
      <path d="M8 24C14 22 20 15 26 6" stroke="var(--muted)" {...STROKE} strokeDasharray="2 3" />
      <path d="M8 18h18" stroke="var(--accent)" {...STROKE} strokeWidth="2" />
    </SymbolFrame>
  );
}
