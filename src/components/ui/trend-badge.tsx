import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small delta chip. Pass a real numeric delta only if you have one —
 * this component never invents trend data.
 */
export function TrendBadge({
  value,
  suffix = "%",
  positiveIsGood = true,
  className,
}: {
  value: number | null | undefined;
  suffix?: string;
  positiveIsGood?: boolean;
  className?: string;
}) {
  if (value == null || Number.isNaN(value)) return null;
  const positive = value > 0;
  const negative = value < 0;
  const good = positiveIsGood ? positive : negative;
  const bad = positiveIsGood ? negative : positive;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-medium",
        good && "bg-success-soft text-success-soft-foreground",
        bad && "bg-destructive-soft text-destructive-soft-foreground",
        !good && !bad && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}
