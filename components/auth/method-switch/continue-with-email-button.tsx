"use client";

import { Button } from "@heroui/react";
import { Mail } from "lucide-react";

import { AUTH_CHOICE_BUTTON } from "./button-size";

/**
 * Swaps the provider buttons for the email form. Drawn like the provider
 * buttons above it, because it is the third way in, not a lesser one.
 *
 * Not the action that accepts the Terms — it only reveals a form — so the legal
 * documents, which quote the buttons that do, do not name it.
 */
export function ContinueWithEmailButton({
  autoFocus,
  onPress,
}: {
  /** Only when returning from the email form, never on page load. */
  autoFocus: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      fullWidth
      size={AUTH_CHOICE_BUTTON.size}
      className={AUTH_CHOICE_BUTTON.className}
      autoFocus={autoFocus}
      onPress={onPress}
    >
      <Mail aria-hidden="true" />
      Continue with email
    </Button>
  );
}
