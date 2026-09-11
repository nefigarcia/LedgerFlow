"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { registerUserAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";

export function RegisterForm() {
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
          const res = await registerUserAction(fd);
          if (!res.success) {
            if (res.error.fieldErrors) {
              const flat: Record<string, string> = {};
              for (const k in res.error.fieldErrors) flat[k] = res.error.fieldErrors[k][0];
              setErrors(flat);
            }
            toast.error("Could not create account", { description: res.error.message });
            return;
          }
          // Meta Pixel tracking for CompleteRegistration event
          if (typeof window !== "undefined" && typeof window.fbq === "function") {
          window.fbq("track", "CompleteRegistration");
          }
          const login = await signIn("credentials", {
            email: String(fd.get("email") ?? "").trim().toLowerCase(),
            password: String(fd.get("password") ?? ""),
            redirect: false,
          });
          if (!login || login.error) {
            toast.error("Account created but sign-in failed. Try signing in.");
            router.push("/login");
            return;
          }
          toast.success("Account created");
          router.push("/onboarding");
          router.refresh();
        });
      }}
    >
      <Field label="Your name" htmlFor="name" error={errors.name} required>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password" hint="Minimum 8 characters." error={errors.password} required>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
