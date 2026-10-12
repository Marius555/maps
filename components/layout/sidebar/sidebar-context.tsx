"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { SIDEBAR_COOKIE, SIDEBAR_MAP_COOKIE } from "./sidebar-cookies";

/**
 * Sidebar state.
 *
 * A context rather than a zustand store — unlike the editor and import stores,
 * the initial value comes from the server (a cookie read in the dashboard
 * layout), and a module-scoped store has no way to receive it without a
 * post-mount write, which would render expanded and then visibly snap shut.
 */

/** A preference, not data — the same year `SIDEBAR_COOKIE` is kept for. */
const COOKIE_TAIL = ";path=/;max-age=31536000;samesite=lax";

type SidebarContextValue = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapsed: () => void;
  /**
   * Collapse the rail while a screen needs the width, without touching the
   * saved preference. `false` hands it back. Use `useCollapsedSidebarWhileMounted`
   * rather than calling this directly.
   */
  holdCollapsed: (held: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  /**
   * The map shown off a map's own pages: the last opened, or the account's most
   * recent when that is not this account's (`sidebarMapId`), or null for an
   * account with no maps. The URL's own map always wins over it.
   */
  lastMapId: string | null;
  /** Remember a map; null forgets it (a remembered map that has been deleted). */
  rememberMap: (mapId: string | null) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  defaultCollapsed,
  defaultMapId,
  children,
}: {
  defaultCollapsed: boolean;
  defaultMapId: string | null;
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  /*
   * A screen asking for the width, separate from the preference. The import
   * wizard's Columns step is a table wider than any laptop, so it holds the rail
   * shut while it is on screen and lets go when it leaves. Kept apart from
   * `isCollapsed` so that letting go returns the rail to what the user chose, and
   * so the cookie never records it.
   */
  const [isHeld, setIsHeld] = useState(false);
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [lastMapId, setLastMapId] = useState(defaultMapId);

  const rememberMap = useCallback((mapId: string | null) => {
    setLastMapId(mapId);

    document.cookie = mapId
      ? `${SIDEBAR_MAP_COOKIE}=${encodeURIComponent(mapId)}${COOKIE_TAIL}`
      : `${SIDEBAR_MAP_COOKIE}=;path=/;max-age=0;samesite=lax`;
  }, []);

  const toggleCollapsed = useCallback(() => {
    /*
     * Held shut, the rail reads as collapsed whatever the preference says, so the
     * toggle can only mean "open it": the hold goes and the preference becomes
     * expanded. Flipping the preference instead would do nothing visible for
     * someone whose preference was already expanded.
     */
    if (isHeld) {
      setIsHeld(false);
      setIsCollapsed(false);
      document.cookie = `${SIDEBAR_COOKIE}=0${COOKIE_TAIL}`;
      return;
    }

    setIsCollapsed((collapsed) => {
      const next = !collapsed;

      // Written here rather than in an effect so the next server render already
      // knows the answer. A year is arbitrary but this is a preference, not data.
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}${COOKIE_TAIL}`;

      return next;
    });
  }, [isHeld]);

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
    () => ({
      isCollapsed: isHeld || isCollapsed,
      isMobileOpen,
      toggleCollapsed,
      holdCollapsed: setIsHeld,
      setMobileOpen,
      lastMapId,
      rememberMap,
    }),
    [isHeld, isCollapsed, isMobileOpen, toggleCollapsed, lastMapId, rememberMap],
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

/**
 * Hold the desktop rail shut while `isHeld` is true.
 *
 * For a screen that needs the width: the import wizard's Columns table. When the
 * flag goes false, or the caller unmounts, the rail returns to the saved
 * preference. The toggle still works in the meantime, and pressing it lets go of
 * the hold.
 *
 * A flag rather than "while mounted", because the wizard's steps leave through
 * an exit animation: the Columns step stays mounted until it has faded out, and
 * that took seconds in a busy tab and never ends in a background one.
 */
export function useCollapsedSidebarWhile(isHeld: boolean): void {
  const { holdCollapsed } = useSidebar();

  useEffect(() => {
    if (!isHeld) return;

    holdCollapsed(true);
    return () => holdCollapsed(false);
  }, [isHeld, holdCollapsed]);
}
