import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney, type MoneyInput } from "@/lib/money/money";

interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: MoneyInput;
  currency?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "hero";
  tone?: "default" | "muted" | "positive" | "negative";
  signed?: boolean;
  compact?: boolean;
}

const SIZES: Record<NonNullable<MoneyProps["size"]>, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl font-semibold tracking-tight",
  xl: "text-3xl font-semibold tracking-tight",
  hero: "text-5xl font-semibold tracking-tighter md:text-6xl",
};

const TONES: Record<NonNullable<MoneyProps["tone"]>, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  positive: "text-success",
  negative: "text-destructive",
};

/**
 * Money — single source of truth for financial number rendering.
 * Handles tabular numerals, size scale, semantic tone, and optional
 * explicit sign for delta contexts.
 */
export function Money({
  value,
  currency = "USD",
  size = "md",
  tone = "default",
  signed = false,
  compact = false,
  className,
  ...rest
}: MoneyProps) {
  const formatted = formatMoney(value, currency, compact ? { maximumFractionDigits: 0 } : undefined);
  const asNumber = Number(value ?? 0);
  const prefix = signed && asNumber > 0 ? "+" : "";
  return (
    <span
      {...rest}
      data-money
      className={cn("num inline-block whitespace-nowrap", SIZES[size], TONES[tone], className)}
    >
      {prefix}
      {formatted}
    </span>
  );
}
