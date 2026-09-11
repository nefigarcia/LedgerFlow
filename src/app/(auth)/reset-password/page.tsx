import Link from "next/link";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Choose a strong password you haven&apos;t used elsewhere.</p>
      </div>
      <ResetForm token={token ?? ""} />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="hover:text-foreground">← Back to sign in</Link>
      </p>
    </div>
  );
}
