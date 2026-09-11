import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money/money";

interface Row {
  key: string;
  label: string;
  value: number;
  share?: number;
  href?: string;
  meta?: React.ReactNode;
}

/**
 * BarList — horizontal ranking with proportional in-row bars.
 * Great for revenue-by-client, expense-by-category, and any share
 * distribution where users need to compare at a glance.
 */
export function BarList({
  rows,
  currency = "USD",
  max = 6,
  className,
}: {
  rows: Row[];
  currency?: string;
  max?: number;
  className?: string;
}) {
  const top = rows.slice(0, max);
  const maxValue = top.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  return (
    <ul className={cn("space-y-2", className)}>
      {top.map((r) => {
        const pct = (r.value / maxValue) * 100;
        const inner = (
          <div className="relative overflow-hidden rounded-md px-3 py-2 transition-colors hover:bg-surface-hover">
            <div
              className="absolute inset-y-0 left-0 origin-left animate-grow-x rounded-md bg-primary/8"
              style={{ width: `${pct}%` }}
              aria-hidden
            />
            <div className="relative flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.label}</div>
                {r.meta ? <div className="text-2xs text-muted-foreground">{r.meta}</div> : null}
              </div>
              <div className="flex items-center gap-3 text-sm">
                {r.share != null ? (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-2xs font-medium text-primary-soft-foreground">
                    {r.share.toFixed(0)}%
                  </span>
                ) : null}
                <span className="num font-medium">{formatMoney(r.value, currency)}</span>
              </div>
            </div>
          </div>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <a href={r.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                {inner}
              </a>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
