import * as React from "react";
import { cn } from "@/lib/utils";

type Status =
  | "draft"
  | "sent"
  | "viewed"
  | "paid"
  | "partial"
  | "overdue"
  | "void"
  | "active"
  | "archived"
  | "upcoming"
  | "dueSoon"
  | "completed"
  | "onHold"
  | "lead";

const MAP: Record<Status, { label: string; className: string; dot: string }> = {
  draft:    { label: "Draft",     className: "bg-muted text-muted-foreground",                    dot: "bg-muted-foreground/60" },
  sent:     { label: "Sent",      className: "bg-primary-soft text-primary-soft-foreground",      dot: "bg-primary" },
  viewed:   { label: "Viewed",    className: "bg-primary-soft text-primary-soft-foreground",      dot: "bg-primary" },
  paid:     { label: "Paid",      className: "bg-success-soft text-success-soft-foreground",      dot: "bg-success" },
  partial:  { label: "Partial",   className: "bg-warning-soft text-warning-soft-foreground",      dot: "bg-warning" },
  overdue:  { label: "Overdue",   className: "bg-destructive-soft text-destructive-soft-foreground", dot: "bg-destructive" },
  void:     { label: "Void",      className: "bg-muted text-muted-foreground/80 line-through",    dot: "bg-muted-foreground/40" },
  active:   { label: "Active",    className: "bg-success-soft text-success-soft-foreground",      dot: "bg-success" },
  archived: { label: "Archived",  className: "bg-muted text-muted-foreground",                    dot: "bg-muted-foreground/60" },
  upcoming: { label: "Upcoming",  className: "bg-primary-soft text-primary-soft-foreground",      dot: "bg-primary" },
  dueSoon:  { label: "Due soon",  className: "bg-warning-soft text-warning-soft-foreground",      dot: "bg-warning" },
  completed:{ label: "Completed", className: "bg-success-soft text-success-soft-foreground",      dot: "bg-success" },
  onHold:   { label: "On hold",   className: "bg-warning-soft text-warning-soft-foreground",      dot: "bg-warning" },
  lead:     { label: "Lead",      className: "bg-muted text-muted-foreground",                    dot: "bg-muted-foreground/60" },
};

export function StatusBadge({
  status,
  label,
  className,
  size = "md",
}: {
  status: Status;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const config = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-0.5 text-xs",
        config.className,
        className,
      )}
    >
      <span className={cn("inline-block rounded-full", size === "sm" ? "h-1 w-1" : "h-1.5 w-1.5", config.dot)} />
      {label ?? config.label}
    </span>
  );
}

/**
 * Convenience: map raw Prisma InvoiceStatus enum → StatusBadge variant.
 */
export function invoiceStatusToBadge(status: string, dueDate?: Date | string | null): Status {
  const s = status.toUpperCase();
  if (s === "PAID") return "paid";
  if (s === "VOID") return "void";
  if (s === "DRAFT") return "draft";
  if (s === "PARTIALLY_PAID") return "partial";
  if (s === "OVERDUE") return "overdue";
  if ((s === "SENT" || s === "VIEWED") && dueDate) {
    const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
    if (d && d < new Date()) return "overdue";
  }
  if (s === "SENT" || s === "VIEWED") return "sent";
  return "draft";
}

export function projectStatusToBadge(status: string): Status {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "ARCHIVED") return "archived";
  if (s === "COMPLETED") return "completed";
  if (s === "ON_HOLD") return "onHold";
  if (s === "LEAD") return "lead";
  return "active";
}

export function taxStatusToBadge(status: string): Status {
  const s = status.toUpperCase();
  if (s === "PAID") return "paid";
  if (s === "OVERDUE") return "overdue";
  if (s === "DUE_SOON") return "dueSoon";
  return "upcoming";
}
