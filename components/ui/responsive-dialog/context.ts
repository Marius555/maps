"use client";

import { createContext, useContext } from "react";

/** Which overlay the nearest `ResponsiveDialog` rendered: a centred modal or a bottom drawer. */
export type DialogShell = "modal" | "drawer";

export const DialogShellContext = createContext<DialogShell>("modal");

export function useDialogShell(): DialogShell {
  return useContext(DialogShellContext);
}
