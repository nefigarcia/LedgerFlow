"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resetPasswordAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setErrors({});
        start(async () => {
          const res = await resetPasswordAction(fd);
          if (!res.success) {
            if (res.error.fieldErrors) {
              const flat: Record<string, string> = {};
              for (const k in res.error.fieldErrors) flat[k] = res.error.fieldErrors[k][0];
              setErrors(flat);
            }
            toast.error(res.error.message);
            return;
          }
          toast.success("Password updated. Please sign in.");
          router.push("/login");
        });
      }}
    >
      <input type="hidden" name="token" defaultValue={token} />
      <Field label="New password" htmlFor="password" error={errors.password} required>
        <Input id="password" name="password" type="password" minLength={8} required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
