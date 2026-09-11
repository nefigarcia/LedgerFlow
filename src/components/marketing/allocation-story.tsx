"use client";
import { CashAllocationBar } from "@/components/ui/cash-allocation-bar";
import { Money } from "@/components/ui/money";
import { ArrowRight } from "lucide-react";

export function AllocationStory() {
  return (
    <div className="grid gap-6 rounded-2xl border border-border/70 bg-surface p-6 md:grid-cols-2 md:p-10">
      <div>
        <div className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Your bank balance isn&apos;t your real balance</div>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          $24,500 in the account.<br />
          <span className="text-primary">$14,700</span> is actually yours.
        </h3>
        <p className="mt-4 max-w-md text-sm text-muted-foreground">
          Taxes will take a slice. Your business needs an operating reserve.
          What&apos;s left is the number owners should care about.
        </p>
      </div>
      <div className="rounded-xl border border-border/70 bg-background p-5">
        <div className="flex items-center justify-between text-sm">
          <div>
            <div className="text-2xs uppercase tracking-widest text-muted-foreground">Recorded cash</div>
            <Money value={24500} currency="USD" size="lg" />
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
          <div className="text-right">
            <div className="text-2xs uppercase tracking-widest text-muted-foreground">Available</div>
            <Money value={14700} currency="USD" size="lg" tone="positive" />
          </div>
        </div>
        <div className="mt-4">
          <CashAllocationBar
            currency="USD"
            segments={[
              { key: "a", label: "Available", amount: 14700, color: "bg-success" },
              { key: "t", label: "Tax reserve", amount: 6800, color: "bg-primary" },
              { key: "o", label: "Operating reserve", amount: 3000, color: "bg-warning" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
