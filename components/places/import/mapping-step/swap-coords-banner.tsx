"use client";

import { Alert, Button } from "@heroui/react";

/**
 * Latitude and longitude the wrong way round.
 *
 * Detectable with certainty rather than guessed at: a longitude past ±90 cannot
 * be a latitude, so a "latitude" column full of them is proof, not a hunch. Left
 * alone it is the worst failure mode in the import — every pin lands somewhere
 * plausible-looking and wrong, and the geocoder never runs to catch it because
 * the rows already have coordinates.
 */
export function SwapCoordsBanner({ onSwap }: { onSwap: () => void }) {
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>These columns look swapped</Alert.Title>
        <Alert.Description>
          The latitude column holds values past 90, which only a longitude can.
          Left as they are, every location will land in the wrong place.
        </Alert.Description>
        <Button size="sm" variant="secondary" className="mt-2" onPress={onSwap}>
          Swap them
        </Button>
      </Alert.Content>
    </Alert>
  );
}
