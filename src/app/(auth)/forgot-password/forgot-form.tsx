"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestPasswordResetAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ForgotForm() {
  const [pending, start] = useTransition();
  const [devToken, setDevToken] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await requestPasswordResetAction(fd);
          if (!res.success) {
            toast.error(res.error.message);
            return;
          }
          if (res.data.token) {
            setDevToken(res.data.token);
          } else {
            toast.success("If an account exists, a reset link has been sent.");
          }
        });
      }}
    >
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      {devToken ? (
        <Alert variant="info">
          <AlertDescription>
            Development mode — email delivery is not configured. Reset link:
            <br />
            <a className="break-all text-primary underline" href={`/reset-password?token=${devToken}`}>
              /reset-password?token={devToken}
            </a>
          </AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
