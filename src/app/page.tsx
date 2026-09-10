import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND } from "@/lib/brand";
import { ArrowRight, ShieldCheck, Wallet, Calculator, HandCoins, FileText, Sparkles, TrendingUp } from "lucide-react";
import { PLANS } from "@/lib/plans/plans";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/"><BrandMark /></Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#safe-to-spend" className="hover:text-foreground">Cash clarity</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link href="/register">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          For consultants, agencies, contractors, and small partnerships
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
          Know what your business money <span className="text-primary">actually means.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Track invoices, expenses, taxes, and owner distributions in one simple financial command center.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg"><Link href="/register">Start free <ArrowRight className="h-4 w-4" /></Link></Button>
          <Button asChild variant="outline" size="lg"><Link href="#features">See how it works</Link></Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Not a replacement for a CPA or bookkeeping. A clarity tool for owners.</p>
      </section>

      <section id="safe-to-spend" className="mx-auto max-w-5xl px-4 pb-16">
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="border-b bg-muted/30">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">The centerpiece</div>
            <CardTitle className="text-2xl">Safe-to-distribute cash</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 p-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">A single, obvious calculation that tells owners what they can actually take home:</p>
              <ul className="mt-4 space-y-1 font-mono text-sm">
                <li>Recorded cash</li>
                <li className="text-muted-foreground">− Remaining tax reserve</li>
                <li className="text-muted-foreground">− Minimum operating reserve</li>
                <li className="mt-2 border-t pt-2 font-semibold">= Available to distribute</li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">Planning estimate based on your recorded transactions. Never marketed as tax advice.</p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="text-xs uppercase text-muted-foreground">Available</div>
              <div className="num mt-1 text-4xl font-semibold text-success">$14,700</div>
              <div className="mt-4 space-y-1 text-sm">
                <Row label="Recorded cash" value="$24,500" />
                <Row label="Tax reserve" value="− $6,800" muted />
                <Row label="Operating reserve" value="− $3,000" muted />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Everything owners actually need. Nothing they don&apos;t.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Not accounting software. Not a bookkeeping tool. A clarity layer for the owners who run the business.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature icon={<Wallet />} title="Recorded cash position" body="Payments minus expenses, distributions, and tax payments. Always visible." />
          <Feature icon={<Calculator />} title="Tax reserve planning" body="Configurable reserve rate, per-owner overrides, and quarterly payment tracking." />
          <Feature icon={<HandCoins />} title="Owner distributions" body="Recommended allocations from a shared pool, tracked and reconciled." />
          <Feature icon={<FileText />} title="Professional invoices" body="Sequential numbering, PDF export, partial payments, overdue tracking." />
          <Feature icon={<TrendingUp />} title="Forecasts you can trust" body="Deterministic math on your real data — conservative, base, optimistic scenarios." />
          <Feature icon={<Sparkles />} title="AI that stays in bounds" body="Ask questions about your business. It only ever sees your organization&apos;s aggregates." />
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Simple, transparent pricing</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">Start free, upgrade when you outgrow it.</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {Object.values(PLANS).map((p) => (
            <Card key={p.id} className={p.id === "TEAM" ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{p.name}</span>
                  <span className="num text-2xl">${p.priceMonthly}<span className="text-sm text-muted-foreground">/mo</span></span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-4 w-full" variant={p.id === "TEAM" ? "default" : "outline"}>
                  <Link href="/register">Start {p.name}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-semibold tracking-tight">FAQ</h2>
        <div className="mt-8 space-y-4 text-sm">
          <Faq q={`Does ${BRAND.name} replace my accountant?`} a="No. It's a management tool for owners. Continue to work with your bookkeeper and CPA — this makes those conversations more productive." />
          <Faq q="Does it file taxes?" a="No. It helps you plan reserves and track quarterly estimated payments, but does not file returns or calculate authoritative tax liability." />
          <Faq q="Where does the data live?" a="You bring your own MySQL database. Every business is fully isolated from every other in the same deployment." />
          <Faq q="Is the AI safe with my numbers?" a="The assistant only ever sees your organization's aggregated metrics — never another tenant's data, never raw records unless you ask for them." />
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <div><BrandMark /></div>
          <p>© {new Date().getFullYear()} {BRAND.name}. Not tax, legal, or accounting advice.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-2 grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="num font-medium">{value}</span>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="font-medium">{q}</p>
        <p className="mt-1 text-muted-foreground">{a}</p>
      </CardContent>
    </Card>
  );
}
