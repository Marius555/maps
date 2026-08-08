/** A section heading inside the sidebar. Hidden when collapsed, where there is
 *  no room for it and the icons have to speak for themselves. */
export function SidebarGroupLabel({
  children,
  isCollapsed,
}: {
  children: React.ReactNode;
  isCollapsed: boolean;
}) {
  if (isCollapsed) return null;

  return (
    <p className="truncate px-2.5 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </p>
  );
}
