"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { PinImageField } from "./pin-image-field";

/**
 * The Image tab of the builder: a logo in place of an icon.
 *
 * The buttons and nothing else. The pin beside it already shows the image, so a
 * thumbnail and a sentence describing it said the same thing twice. Failures
 * are shown here, under the button that raised them, as the normaliser's own
 * sentences.
 */
export function PinImagePanel({
  image,
  onChange,
}: {
  /** The pin's image as a data URI, or "" when it has none yet. */
  image: string;
  /** "" removes the image. */
  onChange: (image: string) => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <PinImageField hasImage={Boolean(image)} onChange={onChange} onProblem={setProblem} />

        {image ? (
          <Button variant="tertiary" onPress={() => onChange("")}>
            Remove image
          </Button>
        ) : null}
      </div>

      {problem ? <ErrorMessage error={problem} /> : null}
    </div>
  );
}
