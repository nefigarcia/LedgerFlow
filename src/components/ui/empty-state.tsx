import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, secondary, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary-soft/60 text-primary">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {(action || secondary) ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}
