import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tooltip?: React.ReactNode;
  trend?: React.ReactNode;
  className?: string;
  emphasis?: "default" | "positive" | "warning" | "danger";
}

export function MetricCard({ label, value, hint, tooltip, trend, className, emphasis = "default" }: MetricCardProps) {
  const emphasisClass =
    emphasis === "positive"
      ? "text-success"
      : emphasis === "warning"
        ? "text-warning"
        : emphasis === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{label}</span>
          {tooltip ? (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button aria-label="How is this calculated?" className="text-muted-foreground/70 hover:text-foreground">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs whitespace-pre-line text-left leading-relaxed">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        <div className={cn("mt-2 num text-2xl font-semibold tracking-tight", emphasisClass)}>{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
        {trend ? <div className="mt-2 text-xs">{trend}</div> : null}
      </CardContent>
    </Card>
  );
}
