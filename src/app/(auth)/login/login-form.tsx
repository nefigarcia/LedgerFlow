"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";

export function LoginForm() {
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
          const res = await signIn("credentials", {
            email: String(fd.get("email") ?? "").trim().toLowerCase(),
            password: String(fd.get("password") ?? ""),
            redirect: false,
          });
          if (!res || res.error) {
            toast.error("Sign in failed", { description: "Email or password is incorrect." });
            setErrors({ password: "Invalid credentials" });
            return;
          }
          toast.success("Welcome back");
          router.push("/app");
          router.refresh();
        });
      }}
    >
      <Field label="Email" htmlFor="email" error={errors.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password} required>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
