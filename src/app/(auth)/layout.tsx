import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { BRAND } from "@/lib/brand";
import { Check } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background md:grid-cols-2">
      {/* Left panel — brand story (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary/8 via-surface to-surface md:flex md:flex-col md:justify-between md:p-10">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-success/8 blur-3xl" />
        </div>
        <div className="relative z-10">
          <Link href="/"><BrandMark size="lg" /></Link>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Know what your business money actually means.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{BRAND.tagline}</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Recorded cash, always visible",
              "Tax reserve target and remaining runway",
              "Owner distributions, safely allocated",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 text-2xs text-muted-foreground">
          © {new Date().getFullYear()} {BRAND.name}
        </div>
      </aside>

      {/* Right panel — form */}
      <main className="flex flex-col">
        <header className="flex items-center justify-between border-b border-border/70 px-4 py-3 md:hidden">
          <Link href="/"><BrandMark /></Link>
          <Link href="/" className="text-2xs text-muted-foreground hover:text-foreground">Back to site</Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}
