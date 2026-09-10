import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { BRAND } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <BrandMark />
          </Link>
          <p className="hidden text-sm text-muted-foreground sm:block">{BRAND.tagline}</p>
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center px-4 py-10">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
