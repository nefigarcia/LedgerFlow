import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) redirect("/app");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your LedgerFlow workspace.</p>
      </div>
      <LoginForm />
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
          Forgot password?
        </Link>
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create account →
        </Link>
      </div>
    </div>
  );
}
