import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <ForgotForm />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="hover:text-foreground">← Back to sign in</Link>
      </p>
    </div>
  );
}
