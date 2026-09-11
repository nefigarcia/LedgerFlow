"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money/money";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Segment {
  key: string;
  label: string;
  amount: number;
  color: string;       // tailwind bg-* class
  labelColor?: string; // tailwind text-* class
  meaning?: string;
}

/**
 * Proportional segmented bar that shows how recorded cash is allocated.
 * Handles zero / negative gracefully (empty state), and never inflates
 * a "$0" bar into a full pattern.
 */
export function CashAllocationBar({
  segments,
  currency = "USD",
  className,
  showLegend = true,
  compact = false,
}: {
  segments: Segment[];
  currency?: string;
  className?: string;
  showLegend?: boolean;
  compact?: boolean;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.amount), 0);
  const hasData = total > 0;

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex overflow-hidden rounded-full border border-border/70 bg-surface-sunken",
          compact ? "h-2" : "h-3",
        )}
        role="img"
        aria-label={`Cash allocation across ${segments.map((s) => s.label).join(", ")}`}
      >
        {hasData ? (
          <TooltipProvider delayDuration={80}>
            {segments.map((seg) => {
              const pct = Math.max(0, seg.amount) / total * 100;
              if (pct <= 0) return null;
              return (
                <Tooltip key={seg.key}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "h-full origin-left cursor-pointer transition-all animate-grow-x",
                        seg.color,
                        "hover:brightness-110 focus:brightness-110",
                      )}
                      style={{ width: `${pct}%` }}
                      tabIndex={0}
                      aria-label={`${seg.label}: ${formatMoney(seg.amount, currency)} (${pct.toFixed(1)}%)`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="px-3 py-2">
                    <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{seg.label}</div>
                    <div className="mt-0.5 num text-sm font-semibold text-foreground">
                      {formatMoney(seg.amount, currency)}
                    </div>
                    <div className="text-2xs text-muted-foreground">{pct.toFixed(1)}% of recorded cash</div>
                    {seg.meaning ? <div className="mt-1 max-w-[220px] text-2xs text-muted-foreground">{seg.meaning}</div> : null}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        ) : null}
      </div>

      {showLegend ? (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {segments.map((seg) => {
            const pct = hasData ? Math.max(0, seg.amount) / total * 100 : 0;
            return (
              <li key={seg.key} className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", seg.color)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn("truncate font-medium", seg.labelColor ?? "text-foreground")}>{seg.label}</span>
                    <span className="num text-muted-foreground">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="num text-sm font-semibold">{formatMoney(seg.amount, currency)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
