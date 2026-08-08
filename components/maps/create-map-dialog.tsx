"use client";

import { Button, Modal } from "@heroui/react";
import { useState } from "react";

import { CreateMapForm } from "./create-map-form";

export function CreateMapDialog({
  label = "Create map",
  variant,
}: {
  label?: string;
  variant?: "primary" | "secondary" | "tertiary";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onPress={() => setIsOpen(true)}>
        {label}
      </Button>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Create map</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <CreateMapForm onCreated={() => setIsOpen(false)} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
