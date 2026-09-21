"use client";

import { Button } from "@heroui/react";
import { MailCheck } from "lucide-react";

import { ErrorMessage } from "@/components/ui/error-message";
import { useResendVerification } from "@/lib/query/auth";

/**
 * Send the confirmation link again, to an address we already know.
 *
 * The counterpart to `components/auth/resend-verification-form.tsx`, and the
 * difference between them is who is asking. That form answers strangers — anyone
 * can type any address into it — so it takes an input and is careful never to
 * admit whether an account exists. This one is only ever rendered for someone
 * signed in, about their own inbox, so it needs no field and the same hedge here
 * would just be confusing: "if an account exists" said to the person whose
 * account it obviously is reads as a system that has lost track.
 *
 * The route behind both is the same `POST /api/auth/verify-email`, already
 * throttled at three per fifteen minutes per address (`lib/auth/throttle.ts`), so
 * holding the button down costs our Resend quota nothing.
 *
 * It swaps itself for the confirmation rather than showing both, because the
 * useful next action after pressing it is in a mail client, not here. Pressing it
 * twice sends a second identical link and invalidates nothing, but it does make
 * the inbox harder to read.
 *
 * `align` exists because the two callers sit differently: in the banner it is one
 * control in a row of text and hugs the start, while on `/verify-email?status=sent`
 * it is the only action on a centred column and has to line up under the heading.
 */
export function ResendLinkButton({
  email,
  size = "sm",
  variant = "secondary",
  align = "start",
}: {
  email: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "tertiary";
  align?: "start" | "center";
}) {
  const resend = useResendVerification();
  const centred = align === "center";

  if (resend.isSuccess) {
    return (
      <p
        className={`flex items-center gap-2 text-xs text-muted ${
          centred ? "justify-center" : ""
        }`}
      >
        <MailCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
        A new link is on its way to {email}.
      </p>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${centred ? "items-center" : "items-start"}`}>
      {resend.error ? <ErrorMessage error={resend.error} /> : null}

      <Button
        size={size}
        variant={variant}
        isPending={resend.isPending}
        onPress={() => resend.mutate({ email })}
      >
        Send a new link
      </Button>
    </div>
  );
}
