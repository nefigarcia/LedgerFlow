"use client";
import { Money } from "@/components/ui/money";
import { CashAllocationBar } from "@/components/ui/cash-allocation-bar";
import { ArrowDownRight, ArrowUpRight, FileText, CreditCard, Receipt } from "lucide-react";
import { formatMoney } from "@/lib/money/money";

/**
 * DashboardPreview — a marketing product visual using real components
 * so it always reflects the actual application, not a design mock.
 * All values are static marketing demo values.
 */
export function DashboardPreview() {
  return (
    <div className="pointer-events-none select-none rounded-2xl border border-border/70 bg-surface shadow-lg">
      {/* Faux top bar */}
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-warning/60" />
          <div className="h-2 w-2 rounded-full bg-success/60" />
          <div className="h-2 w-2 rounded-full bg-primary/60" />
          <span className="ml-2 font-medium tracking-tight">Overview</span>
        </div>
        <div className="hidden text-2xs text-muted-foreground sm:block">Sep 10 · Today</div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* Signature panel */}
        <div className="rounded-xl bg-gradient-to-br from-primary-soft/60 via-surface to-surface p-4">
          <div className="flex items-center gap-2 text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
            Available to distribute
          </div>
          <div className="mt-2">
            <Money value={14700} currency="USD" size="xl" tone="positive" />
          </div>
          <p className="mt-1 text-2xs text-muted-foreground">Safe after taxes and operating reserve.</p>

          <div className="mt-4 rounded-lg border border-border/60 bg-surface/70 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xs uppercase tracking-widest text-muted-foreground">Recorded cash</div>
                <div className="mt-0.5"><Money value={24500} currency="USD" size="md" /></div>
              </div>
              <div className="text-right">
                <div className="text-2xs uppercase tracking-widest text-muted-foreground">Available</div>
                <div className="mt-0.5"><Money value={14700} currency="USD" size="sm" tone="positive" /></div>
              </div>
            </div>
            <div className="mt-3">
              <CashAllocationBar
                currency="USD"
                showLegend={false}
                segments={[
                  { key: "a", label: "Available", amount: 14700, color: "bg-success" },
                  { key: "t", label: "Tax reserve", amount: 6800, color: "bg-primary" },
                  { key: "o", label: "Operating", amount: 3000, color: "bg-warning" },
                ]}
              />
              <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-2xs">
                <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" />Available <span className="num text-muted-foreground">$14,700</span></li>
                <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Tax <span className="num text-muted-foreground">$6,800</span></li>
                <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" />Operating <span className="num text-muted-foreground">$3,000</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right: metrics + activity */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MiniMetric label="Revenue YTD" value={formatMoney(84250, "USD")} sub="+12.4% MoM" positive />
            <MiniMetric label="Outstanding" value={formatMoney(18450, "USD")} sub="1 overdue" warning />
            <MiniMetric label="Est. profit" value={formatMoney(29400, "USD")} sub="Payments − expenses" />
            <MiniMetric label="Tax reserve" value="72% funded" sub="$8,240 / $11,500" />
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <div className="mb-2 text-2xs font-medium uppercase tracking-widest text-muted-foreground">Recent activity</div>
            <ul className="space-y-2 text-2xs">
              <ActivityRow icon={<CreditCard className="h-3 w-3" />} label="Payment received · INV-034" amount={5200} kind="in" />
              <ActivityRow icon={<Receipt className="h-3 w-3" />} label="Adobe Creative Cloud" amount={54.99} kind="out" />
              <ActivityRow icon={<FileText className="h-3 w-3" />} label="Invoice ACG-2026-018 sent" amount={3600} kind="in" />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, sub, positive, warning }: { label: string; value: string; sub: string; positive?: boolean; warning?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`num mt-1 text-base font-semibold ${positive ? "text-success" : warning ? "text-warning" : ""}`}>{value}</div>
      <div className="mt-0.5 text-2xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function ActivityRow({ icon, label, amount, kind }: { icon: React.ReactNode; label: string; amount: number; kind: "in" | "out" }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`grid h-6 w-6 place-items-center rounded-full ${kind === "in" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
        {kind === "in" ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`num ${kind === "in" ? "text-success" : "text-destructive"}`}>
        {kind === "in" ? "+" : "−"}{formatMoney(amount, "USD")}
      </span>
    </li>
  );
}
