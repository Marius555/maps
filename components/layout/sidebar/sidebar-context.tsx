"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Sidebar state.
 *
 * A context rather than a zustand store — unlike the editor and import stores,
 * the initial value comes from the server (a cookie read in the dashboard
 * layout), and a module-scoped store has no way to receive it without a
 * post-mount write, which would render expanded and then visibly snap shut.
 */

export const SIDEBAR_COOKIE = "sidebar_collapsed";

type SidebarContextValue = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  defaultCollapsed,
  children,
}: {
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((collapsed) => {
      const next = !collapsed;

      // Written here rather than in an effect so the next server render already
      // knows the answer. A year is arbitrary but this is a preference, not data.
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;

      return next;
    });
  }, []);

  // mod+b, the shortcut every sidebar of this shape uses.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "b" || !(event.metaKey || event.ctrlKey)) return;

      event.preventDefault();
      toggleCollapsed();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  const value = useMemo(
    () => ({ isCollapsed, isMobileOpen, toggleCollapsed, setMobileOpen }),
    [isCollapsed, isMobileOpen, toggleCollapsed],
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used inside a SidebarProvider.");
  }

  return context;
}
