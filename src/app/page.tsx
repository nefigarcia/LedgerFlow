import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { PLANS } from "@/lib/plans/plans";
import {
  ArrowRight, Check, FileText, Wallet, Calculator, HandCoins, Sparkles, ShieldCheck, Info,
} from "lucide-react";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { AllocationStory } from "@/components/marketing/allocation-story";
import { Money } from "@/components/ui/money";

export const metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/6 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-success/5 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 pb-8 pt-20 md:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-2xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" />
              Financial clarity for service businesses
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tighter md:text-6xl md:leading-[1.05]">
              Know what your business money{" "}
              <span className="bg-gradient-to-br from-primary to-primary-hover bg-clip-text text-transparent">
                actually means.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              See what you collected, what belongs to taxes, what your business needs to keep,
              and what&apos;s actually available to you as an owner.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button asChild size="xl" className="gap-1.5">
                <Link href="/register">Start free <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-4 text-2xs text-muted-foreground">No credit card required · For consultants, agencies, contractors, and small partnerships</p>
          </div>

          <div className="mt-14 md:mt-20">
            <div className="mx-auto max-w-5xl">
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-6 -bottom-6 -z-10 h-16 bg-primary/12 blur-2xl" aria-hidden />
                <DashboardPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="container mx-auto px-4 py-16 md:py-24">
        <AllocationStory />
      </section>

      <section className="container mx-auto space-y-24 px-4 py-16 md:space-y-32">
        <FeatureSection
          index="01"
          title="Know what you can safely distribute."
          body="LedgerFlow does the math: recorded cash minus tax reserve minus operating reserve. Owners see one confident number."
          icon={<HandCoins className="h-5 w-5" />}
          bullets={["Configurable tax reserve rate", "Fixed or dynamic operating reserve", "Recommended split across owners"]}
        />
        <FeatureSection
          index="02"
          title="Never lose sight of unpaid invoices."
          body="Overdue balances surface at the top of every dashboard. Aging buckets keep receivables honest."
          icon={<FileText className="h-5 w-5" />}
          bullets={["Draft, sent, partial, paid, overdue statuses", "Sequential PDF invoices", "One-click record payment"]}
          reverse
        />
        <FeatureSection
          index="03"
          title="Stay ahead of taxes."
          body="Track your reserve target, quarterly estimated payments, and remaining runway — with a firm boundary: planning estimates, not tax advice."
          icon={<Calculator className="h-5 w-5" />}
          bullets={["Per-owner reserve overrides", "Editable quarterly schedule", "Historical payment log"]}
        />
        <FeatureSection
          index="04"
          title="Understand where money goes."
          body="Categorize expenses by category, client, and project. See month-over-month trends without a spreadsheet."
          icon={<Wallet className="h-5 w-5" />}
          bullets={["Fifteen sensible default categories", "Filter by client, project, or vendor", "CSV exports for your bookkeeper"]}
          reverse
        />
        <FeatureSection
          index="05"
          title="Ask your business questions."
          body="An assistant that only sees your workspace and answers using the same deterministic calculations as the dashboard."
          icon={<Sparkles className="h-5 w-5" />}
          bullets={["Tenant-isolated context", "Grounded in your recorded data", "Refuses to invent numbers"]}
          example
        />
      </section>

      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Pricing</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Straightforward pricing.</h2>
          <p className="mt-3 text-muted-foreground">Start free, upgrade when you outgrow it.</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
          {Object.values(PLANS).map((p) => {
            const highlighted = p.id === "TEAM";
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl border p-6 transition-shadow ${
                  highlighted
                    ? "border-primary/60 bg-primary-soft/30 shadow-lg"
                    : "border-border/70 bg-surface hover:shadow-md"
                }`}
              >
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-2xs font-medium text-primary-foreground">
                    Recommended
                  </div>
                )}
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="num text-4xl font-semibold tracking-tight">${p.priceMonthly}</span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
                <Button
                  asChild
                  variant={highlighted ? "default" : "outline"}
                  className="mt-6 w-full"
                >
                  <Link href="/register">Start {p.name}</Link>
                </Button>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section id="faq" className="container mx-auto max-w-3xl px-4 py-20">
        <div className="text-center">
          <div className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Frequently asked</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Common questions</h2>
        </div>
        <div className="mt-10 space-y-3">
          <Faq q={`Does ${BRAND.name} replace QuickBooks?`} a="No. It's a management tool for owners. Continue to work with your bookkeeper and CPA — LedgerFlow makes those conversations more productive." />
          <Faq q="Does LedgerFlow file my taxes?" a="No. It helps you plan reserves and track quarterly estimated payments. It does not calculate authoritative tax liability or file returns." />
          <Faq q="How does available-to-distribute work?" a="It's a deterministic formula: recorded cash minus remaining tax reserve minus your minimum operating reserve. LedgerFlow shows the calculation transparently." />
          <Faq q="Can I use LedgerFlow with multiple owners?" a="Yes. Each owner has an ownership percentage and an independent distribution percentage. The recommended split is calculated from the distributable pool." />
          <Faq q="Can my accountant access LedgerFlow?" a="Yes. Invite them with the Accountant role — read/write on financials, read-only on organization settings." />
          <Faq q="Is LedgerFlow accounting software?" a="No. LedgerFlow is management-accounting / financial-operations software. It doesn't produce GAAP statements, and it never markets itself as an audit-ready ledger." />
        </div>
      </section>

      <section className="container mx-auto px-4 py-24">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-surface via-surface to-primary-soft/40 p-10 text-center md:p-16">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-2xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-primary" />
            Bring your own MySQL database — your data stays yours.
          </div>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-5xl">
            Stop guessing what your bank balance means.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Know what&apos;s actually available. Set aside what you owe. Distribute what&apos;s yours.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="xl"><Link href="/register">Start using LedgerFlow</Link></Button>
            <Button asChild variant="outline" size="xl"><Link href="/login">Sign in</Link></Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/"><BrandMark /></Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#how-it-works" className="hover:text-foreground">How it works</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link href="/login">Sign in</Link></Button>
          <Button asChild size="sm"><Link href="/register">Get started</Link></Button>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="text-2xs">{BRAND.tagline}</span>
        </div>
        <div className="flex items-center gap-6 text-2xs">
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
          <Link href="/register" className="hover:text-foreground">Get started</Link>
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
        </div>
      </div>
      <div className="container mx-auto flex items-center gap-2 px-4 pb-6 text-2xs text-muted-foreground">
        <Info className="h-3 w-3" /> Not tax, legal, or accounting advice. LedgerFlow is a financial-operations tool for owners.
      </div>
    </footer>
  );
}

function FeatureSection({
  index,
  title,
  body,
  icon,
  bullets,
  reverse,
  example,
}: {
  index: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  bullets: string[];
  reverse?: boolean;
  example?: boolean;
}) {
  return (
    <div className={`grid gap-10 md:grid-cols-2 md:items-center ${reverse ? "md:[direction:rtl]" : ""}`}>
      <div className={reverse ? "md:[direction:ltr]" : ""}>
        <div className="text-2xs font-mono font-medium tracking-widest text-muted-foreground">{index}</div>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h3>
        <p className="mt-4 text-muted-foreground">{body}</p>
        <ul className="mt-6 space-y-2 text-sm">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Check className="h-2.5 w-2.5" />
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? "md:[direction:ltr]" : ""}>
        {example ? (
          <div className="rounded-2xl border border-border/70 bg-surface p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-2xs font-semibold text-secondary-foreground">You</div>
              <div className="rounded-xl bg-muted px-3 py-2 text-sm">Can we distribute $10,000?</div>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-primary-foreground">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 rounded-xl bg-primary-soft/50 px-4 py-3 text-sm">
                <p>
                  Based on transactions recorded in LedgerFlow, your available-to-distribute amount is <Money value={14700} currency="USD" tone="positive" />.
                </p>
                <p className="mt-2 text-muted-foreground">
                  A $10,000 distribution would leave approximately $4,700 above your tax and operating reserves.
                  This is a planning estimate.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-surface to-primary-soft/40 p-8">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>
            <div className="mt-8">
              <DashboardPreview />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-border/70 bg-surface p-5 transition-colors hover:border-border-strong">
      <summary className="flex cursor-pointer items-start justify-between gap-4 text-sm font-medium marker:hidden">
        {q}
        <span className="mt-0.5 text-muted-foreground transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{a}</p>
    </details>
  );
}
