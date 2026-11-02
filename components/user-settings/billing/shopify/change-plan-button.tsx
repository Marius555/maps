"use client";

import { Button } from "@heroui/react";

/**
 * Opens Shopify's plan page for this app, where a shop upgrades, downgrades or
 * cancels — Shopify bills it (App Store requirements 1.2.1 and 1.2.3).
 *
 * In the top window, because it is a Shopify admin page, not ours: opened in
 * the app's frame it would be the admin inside the admin.
 */
export function ChangePlanButton({
  pricingUrl,
  label = "Change plan",
}: {
  pricingUrl: string;
  label?: string;
}) {
  return (
    <Button
      variant="primary"
      className="shrink-0 self-start sm:self-auto"
      onPress={() => window.open(pricingUrl, "_top")}
    >
      {label}
    </Button>
  );
}
