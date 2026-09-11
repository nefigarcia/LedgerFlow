import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session?.user) redirect("/app");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Start managing your business finances in minutes.</p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in →
        </Link>
      </p>
    </div>
  );
}
