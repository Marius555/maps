"use client";

import { Button } from "@heroui/react";
import { ArrowLeft } from "lucide-react";

/** The way back from the email form to Google and GitHub. */
export function BackToProvidersButton({ onPress }: { onPress: () => void }) {
  return (
    <div className="flex justify-center">
      <Button type="button" variant="ghost" size="sm" onPress={onPress}>
        <ArrowLeft aria-hidden="true" />
        Use Google or GitHub instead
      </Button>
    </div>
  );
}
