"use client";

import { Button } from "@heroui/react";

import { AUTH_CHOICE_BUTTON } from "@/components/auth/method-switch/button-size";
import { OAUTH_PROVIDER_LABEL, type OAuthProviderId } from "@/lib/auth/oauth-providers";
import { ProviderMark } from "./provider-marks";

/**
 * One "Sign in with …" button. Presentational: what a press does, and which of
 * the two is pending, belong to `OAuthButtons`.
 *
 * `outline` rather than `secondary`, and this was measured rather than chosen:
 * HeroUI's `secondary` sets `--button-fg` to `--accent-soft-foreground`, so the
 * label *and* the mark came out in our own brand orange — a Google button drawn
 * in somebody else's colour. `outline` is `--default-foreground` on a bordered
 * transparent ground, which is both the conventional treatment for this button
 * and the one that makes `currentColor` on the mark resolve to a neutral.
 *
 * Not `primary`: that is the accent fill the Log in button wears, and two
 * accent-filled buttons on a 384px column leaves neither of them reading as the
 * main action.
 *
 * Larger than the app's default button (`AUTH_CHOICE_BUTTON`): these, with
 * Continue with email, are the whole column when an auth page opens.
 */
export function OAuthButton({
  provider,
  isPending,
  isDisabled,
  onPress,
}: {
  provider: OAuthProviderId;
  isPending: boolean;
  isDisabled: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      fullWidth
      size={AUTH_CHOICE_BUTTON.size}
      className={AUTH_CHOICE_BUTTON.className}
      isPending={isPending}
      isDisabled={isDisabled}
      onPress={onPress}
    >
      <ProviderMark provider={provider} />
      Sign in with {OAUTH_PROVIDER_LABEL[provider]}
    </Button>
  );
}
