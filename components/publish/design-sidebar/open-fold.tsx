"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

import { PropertyFolds } from "@/components/ui/properties/property-folds";

/**
 * Which design fold is open, shared by exactly the two things that answer to
 * it: the folds, and the Publish footer that folds its steps away while one is
 * open (`DesignSidebar`).
 *
 * **A store, not state in the sidebar — and that is measured, not tidiness.**
 * Lifted into `DesignSidebar` as plain state, every fold press re-rendered the
 * whole column — every group's controls, both steppers — and in the dev build
 * that was a ~300ms long task between the press and the first frame of the
 * fold's animation (2026-11-07). The folds alone measured none. So the answer
 * lives here, and only `DesignFolds` and `FoldingFooter` subscribe to it; the
 * groups passed through them as children are the same elements, and React
 * leaves them alone.
 */
export type OpenFoldStore = {
  get: () => string | null;
  set: (openId: string | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function useOpenFoldStore(initial: string | null): OpenFoldStore {
  const [store] = useState<OpenFoldStore>(() => {
    let openId = initial;
    const listeners = new Set<() => void>();

    return {
      get: () => openId,
      set: (next) => {
        if (next === openId) return;
        openId = next;
        for (const listener of listeners) listener();
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  });

  return store;
}

function useOpenFold(store: OpenFoldStore): string | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** The design folds, one open at a time, reporting which to `store`. */
export function DesignFolds({
  store,
  children,
}: {
  store: OpenFoldStore;
  children: ReactNode;
}) {
  const openId = useOpenFold(store);

  return (
    <PropertyFolds openId={openId} onOpenIdChange={store.set}>
      {children}
    </PropertyFolds>
  );
}

/**
 * The Publish footer, told whether a fold is open. `children` draws what goes
 * in it from that: the steps fold away while `isCollapsed`, and `onExpand`
 * closes the fold to bring them back.
 */
export function FoldingFooter({
  store,
  className,
  children,
}: {
  store: OpenFoldStore;
  className?: string;
  children: (fold: { isCollapsed: boolean; onExpand: () => void }) => ReactNode;
}) {
  // The boolean, not the id: moving from one open fold to another changes
  // nothing down here, and an unchanged snapshot is a render React skips.
  const isOpen = () => store.get() !== null;
  const isCollapsed = useSyncExternalStore(store.subscribe, isOpen, isOpen);

  return (
    <footer className={className}>
      {children({ isCollapsed, onExpand: () => store.set(null) })}
    </footer>
  );
}
