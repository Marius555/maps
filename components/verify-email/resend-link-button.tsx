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
 * The route behind both is the same `POST /api/auth/verify-email`: one link a
 * minute and three a quarter hour per address in memory, and one a minute and
 * five a day on the account itself (`lib/auth/verify-throttle.ts`).
 *
 * **Always pressable, with no countdown.** It used to sit disabled as "Send
 * again in 0:59", and a clock running down on a button about email reads as an
 * email that will go out when it reaches zero — which nothing ever sent. Now it
 * is one button, pressed when the owner wants another link. A press inside the
 * server's minute sends nothing and says how long is left, in the server's own
 * words, through the error line (signup primes that minute, so this holds
 * straight after signup too).
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

  return (
    <div
      className={`steady flex flex-col gap-2 ${centred ? "items-center" : "items-start"}`}
    >
      {resend.isSuccess ? (
        <p
          role="status"
          className={`flex items-center gap-2 text-xs text-muted ${
            centred ? "justify-center" : ""
          }`}
        >
          <MailCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
          A new link is on its way to {email}.
        </p>
      ) : null}

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
