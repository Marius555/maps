/** What a page says when every section on it had nothing to show. */
export function AdminEmpty({ children }: { children: string }) {
  return <p className="py-10 text-center text-sm text-muted">{children}</p>;
}
