/** A storefront's top row: the logo, the menu, the cart. */
export function StoreHeader() {
  return (
    <div className="flex items-center gap-1.5 border-b border-border pb-1.5">
      <span className="h-1.5 w-6 rounded-full bg-foreground/60" />
      <span className="ml-auto h-1 w-4 rounded-full bg-foreground/20" />
      <span className="h-1 w-4 rounded-full bg-foreground/20" />
      <span className="h-1 w-4 rounded-full bg-foreground/20" />
      <span className="size-2 rounded-[3px] border border-foreground/40" />
    </div>
  );
}
