"use client";
import * as React from "react";
import { ArrowRight, Info, Sparkles } from "lucide-react";
import { Money } from "@/components/ui/money";
import { CashAllocationBar } from "@/components/ui/cash-allocation-bar";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money/money";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface HeroProps {
  currency: string;
  recordedCash: number;
  taxReserveRemaining: number;
  operatingReserve: number;
  available: number;
  askHref?: string;
}

/**
 * FinancialClarityHero — the signature dashboard component.
 * Shows recorded cash → tax → operating → available as a linked
 * visual story instead of four disconnected metric cards.
 */
export function FinancialClarityHero({
  currency,
  recordedCash,
  taxReserveRemaining,
  operatingReserve,
  available,
  askHref,
}: HeroProps) {
  const isEmpty = recordedCash === 0 && taxReserveRemaining === 0 && operatingReserve === 0;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-surface via-surface to-primary-soft/40",
        "shadow-sm dark:from-surface dark:via-surface dark:to-primary-soft/20",
      )}
    >
      {/* Subtle background accent */}
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-success/6 blur-3xl" />
      </div>

      <div className="relative grid gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-10">
        {/* Left: dominant available number */}
        <div className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-2xs font-medium uppercase tracking-widest text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              Available to distribute
            </div>
            <div className="mt-2">
              <Money value={available} currency={currency} size="hero" tone={available > 0 ? "positive" : "default"} />
            </div>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              What&apos;s left after taxes and your operating reserve — a planning estimate based on transactions recorded in LedgerFlow.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <HowCalculatedSheet
              currency={currency}
              recordedCash={recordedCash}
              taxReserveRemaining={taxReserveRemaining}
              operatingReserve={operatingReserve}
              available={available}
            />
            {askHref ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href={askHref}>
                  <Sparkles className="h-3.5 w-3.5" /> Ask about this
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Right: allocation breakdown */}
        <div className="rounded-xl border border-border/70 bg-surface/70 p-5 backdrop-blur-sm dark:bg-surface/40">
          <div className="flex items-center justify-between">
            <div>
              <div className="metric-label">Recorded cash</div>
              <div className="mt-0.5">
                <Money value={recordedCash} currency={currency} size="xl" />
              </div>
            </div>
            <div className="hidden text-right md:block">
              <div className="metric-label">Available</div>
              <div className="mt-0.5">
                <Money value={available} currency={currency} size="lg" tone={available > 0 ? "positive" : "default"} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <CashAllocationBar
              currency={currency}
              segments={[
                {
                  key: "available",
                  label: "Available",
                  amount: available,
                  color: "bg-success",
                  labelColor: "text-success-soft-foreground",
                  meaning: "Safe to distribute after reserves.",
                },
                {
                  key: "tax",
                  label: "Tax reserve",
                  amount: taxReserveRemaining,
                  color: "bg-primary",
                  labelColor: "text-primary-soft-foreground",
                  meaning: "Set aside for upcoming estimated tax payments.",
                },
                {
                  key: "operating",
                  label: "Operating",
                  amount: operatingReserve,
                  color: "bg-warning",
                  labelColor: "text-warning-soft-foreground",
                  meaning: "Minimum cash you want to keep on hand.",
                },
              ]}
            />
          </div>

          {isEmpty ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Record a payment and add expenses to see cash allocation come to life.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function HowCalculatedSheet({
  currency,
  recordedCash,
  taxReserveRemaining,
  operatingReserve,
  available,
}: Omit<HeroProps, "askHref">) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Info className="h-3.5 w-3.5" /> How this is calculated
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md">
        <SheetHeader>
          <SheetTitle>How available-to-distribute is calculated</SheetTitle>
          <SheetDescription>
            LedgerFlow uses a deterministic formula based only on what you&apos;ve recorded.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <FormulaRow label="Recorded cash" value={formatMoney(recordedCash, currency)} accent="foreground" />
          <FormulaRow label="− Remaining tax reserve" value={formatMoney(taxReserveRemaining, currency)} accent="primary" />
          <FormulaRow label="− Operating reserve" value={formatMoney(operatingReserve, currency)} accent="warning" />
          <div className="border-t border-border pt-4">
            <FormulaRow label="Available to distribute" value={formatMoney(available, currency)} accent="success" bold />
          </div>
          <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Recorded cash</strong> = opening balance + payments − expenses − distributions − tax payments</p>
            <p><strong className="text-foreground">Tax reserve target</strong> = max(0, estimated profit × configured reserve rate)</p>
            <p><strong className="text-foreground">Operating reserve</strong> = the fixed minimum you set in Settings → Financial.</p>
            <p className="pt-2">This is a planning estimate, not tax, legal, or accounting advice.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="w-full justify-between">
            <Link href="../settings">
              Adjust reserve settings <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FormulaRow({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: string;
  accent: "foreground" | "primary" | "warning" | "success";
  bold?: boolean;
}) {
  const accentCls =
    accent === "primary" ? "text-primary" :
    accent === "warning" ? "text-warning" :
    accent === "success" ? "text-success" :
    "text-foreground";
  return (
    <div className={cn("flex items-baseline justify-between", bold && "text-base font-semibold")}>
      <span className={cn(!bold && "text-sm text-muted-foreground")}>{label}</span>
      <span className={cn("num", accentCls, bold ? "text-lg" : "text-sm font-medium")}>{value}</span>
    </div>
  );
}
