import * as React from "react";
import Link from "next/link";
import { ArrowRight, AlertTriangle, TrendingUp, TrendingDown, Info, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightTone = "info" | "warning" | "danger" | "success";

interface InsightCardProps {
  tone: InsightTone;
  title: string;
  description?: React.ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  icon?: React.ReactNode;
}

const TONE_MAP: Record<InsightTone, { icon: React.ComponentType<{ className?: string }>; wrap: string; iconWrap: string }> = {
  danger:  { icon: AlertTriangle, wrap: "border-destructive/20 bg-destructive-soft/40",       iconWrap: "bg-destructive/10 text-destructive" },
  warning: { icon: TrendingUp,    wrap: "border-warning/20 bg-warning-soft/40",              iconWrap: "bg-warning/10 text-warning" },
  info:    { icon: Info,          wrap: "border-primary/15 bg-primary-soft/40",              iconWrap: "bg-primary/10 text-primary" },
  success: { icon: CheckCircle2,  wrap: "border-success/20 bg-success-soft/40",              iconWrap: "bg-success/10 text-success" },
};

/**
 * InsightCard — attention item for the dashboard.
 * Always tie the CTA to real, resolvable data. Do not render a CTA if
 * there's no valid href.
 */
export function InsightCard({ tone, title, description, ctaLabel, ctaHref, icon }: InsightCardProps) {
  const config = TONE_MAP[tone];
  const Icon = config.icon;
  return (
    <div className={cn("group relative flex items-start gap-3 rounded-xl border p-4 transition-colors", config.wrap)}>
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", config.iconWrap)}>
        {icon ?? <Icon className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight text-foreground">{title}</div>
        {description ? <div className="mt-0.5 text-xs text-muted-foreground">{description}</div> : null}
        {ctaLabel && ctaHref ? (
          <Link
            href={ctaHref}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground/80 hover:text-foreground"
          >
            {ctaLabel}
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export { TrendingUp, TrendingDown };
