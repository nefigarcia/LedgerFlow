import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  hint?: React.ReactNode;
  trend?: React.ReactNode;
  tooltip?: React.ReactNode;
  emphasis?: "default" | "positive" | "warning" | "danger" | "primary";
  className?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

const EMPHASIS: Record<NonNullable<MetricTileProps["emphasis"]>, string> = {
  default: "text-foreground",
  positive: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  primary: "text-primary",
};

/**
 * MetricTile — replacement for MetricCard.
 * A clean, borderless-first surface for financial numbers with clear
 * hierarchy: label → value → subvalue → trend.
 */
export function MetricTile({
  label,
  value,
  subValue,
  hint,
  trend,
  tooltip,
  emphasis = "default",
  className,
  action,
  compact = false,
}: MetricTileProps) {
  return (
    <div className={cn("panel group relative flex flex-col overflow-hidden", compact ? "p-4" : "p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="metric-label">{label}</span>
        <div className="flex items-center gap-1">
          {trend}
          {tooltip ? (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="How is this calculated?"
                    className="rounded-md p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs whitespace-pre-line text-left leading-relaxed">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </div>
      <div className={cn("mt-2 metric-value tracking-tight", compact ? "text-xl font-semibold" : "text-2xl font-semibold", EMPHASIS[emphasis])}>
        {value}
      </div>
      {subValue ? <div className="mt-1 text-sm text-muted-foreground">{subValue}</div> : null}
      {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function MetricGroup({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
}) {
  const cols =
    columns === 2 ? "grid-cols-1 sm:grid-cols-2" :
    columns === 3 ? "grid-cols-2 lg:grid-cols-3" :
                    "grid-cols-2 lg:grid-cols-4";
  return <div className={cn("grid gap-3", cols, className)}>{children}</div>;
}
