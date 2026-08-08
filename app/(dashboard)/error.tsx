"use client";

import { Button } from "@heroui/react";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground">
        That didn&apos;t load
      </h1>
      <p className="text-sm text-muted">
        Something broke on our side. Try again — if it keeps happening, reload the
        page.
      </p>
      <Button onPress={reset}>Try again</Button>
    </div>
  );
}
