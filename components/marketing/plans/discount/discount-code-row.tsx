"use client";

import { Button, FieldError, InputGroup, Label, TextField } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { IconButton } from "@/components/ui/icon-button";

import type { PublicDiscount } from "@/lib/billing/types";

import type { PricingDiscount } from "./use-pricing-offer";

/**
 * Beside the monthly/yearly toggle: a way to enter a discount code.
 *
 * An applied code is shown on the prices and nowhere else — no "applied" line
 * and no way to take it off again, because nobody wants a discount removed. The
 * field opens unfocused, so opening it does not throw a keyboard up on a phone.
 */
export function DiscountCodeRow({
  discount,
  onApplied,
}: {
  discount: PricingDiscount;
  /** A code the visitor typed was accepted. Not called for one the page arrived with. */
  onApplied?: (applied: PublicDiscount) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState("");
  const { error, checking } = discount;
  // A refused code keeps the field on screen with its reason.
  const showForm = isOpen || error !== null;

  const submit = async () => {
    const code = value.trim();
    if (!code) return;

    // The form stays open on a refusal, so the reason shows under the field.
    const applied = await discount.apply(code);
    if (applied) {
      setIsOpen(false);
      setValue("");
      onApplied?.(applied);
    }
  };

  return (
    <div className="flex min-w-0 flex-col items-center text-sm lg:items-end">
      {showForm ? (
        <form
          className="w-full max-w-xs"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <TextField
            fullWidth
            value={value}
            onChange={(next) => setValue(next.toUpperCase())}
            isInvalid={error !== null}
            aria-label="Discount code"
          >
            <Label className="sr-only">Discount code</Label>
            <InputGroup fullWidth>
              <InputGroup.Input placeholder="Discount code" autoComplete="off" />
              <InputGroup.Suffix className="px-1">
                <IconButton
                  type="submit"
                  label="Apply discount code"
                  icon={ArrowRight}
                  isPending={checking}
                  isDisabled={!value.trim()}
                />
              </InputGroup.Suffix>
            </InputGroup>
            {error ? <FieldError>{error}</FieldError> : null}
          </TextField>
        </form>
      ) : (
        <Button size="sm" variant="ghost" onPress={() => setIsOpen(true)}>
          Have a discount code?
        </Button>
      )}
    </div>
  );
}
