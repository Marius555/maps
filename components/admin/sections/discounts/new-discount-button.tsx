"use client";

import { Button } from "@heroui/react";
import { Plus } from "lucide-react";
import { useState } from "react";

import { DiscountFormDialog } from "./discount-form-dialog";
import { EMPTY_DISCOUNT } from "./discount-options";

export function NewDiscountButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button size="sm" onPress={() => setIsOpen(true)}>
        <Plus aria-hidden="true" className="size-4" />
        New discount
      </Button>
      <DiscountFormDialog
        title="New discount"
        defaultValues={isOpen ? EMPTY_DISCOUNT : null}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
