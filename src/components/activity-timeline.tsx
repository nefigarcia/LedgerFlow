import * as React from "react";
import {
  FileText,
  CreditCard,
  Receipt,
  HandCoins,
  Calculator,
  UserPlus,
  FolderKanban,
  Users2,
  Circle,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/dates/dates";

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  message: string;
  createdAt: Date;
}

const ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; wrap: string }> = {
  invoice:      { icon: FileText,     wrap: "bg-primary/10 text-primary" },
  payment:      { icon: CreditCard,   wrap: "bg-success/10 text-success" },
  expense:      { icon: Receipt,      wrap: "bg-warning/10 text-warning" },
  distribution: { icon: HandCoins,    wrap: "bg-primary/10 text-primary" },
  tax:          { icon: Calculator,   wrap: "bg-primary/10 text-primary" },
  client:       { icon: Users2,       wrap: "bg-muted text-muted-foreground" },
  project:      { icon: FolderKanban, wrap: "bg-muted text-muted-foreground" },
  org:          { icon: Building2,    wrap: "bg-muted text-muted-foreground" },
  member:       { icon: UserPlus,     wrap: "bg-muted text-muted-foreground" },
};

function iconForAction(action: string, entityType: string) {
  const key =
    action.split(".")[0] ||
    entityType.toLowerCase();
  return ICONS[key] ?? { icon: Circle, wrap: "bg-muted text-muted-foreground" };
}

export function ActivityTimeline({ items, className }: { items: ActivityItem[]; className?: string }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Activity will appear here as you record invoices, payments, and expenses.
      </p>
    );
  }
  return (
    <ol className={cn("relative", className)}>
      {items.map((item, i) => {
        const { icon: Icon, wrap } = iconForAction(item.action, item.entityType);
        return (
          <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 ? (
              <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" aria-hidden />
            ) : null}
            <div className={cn("relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-surface", wrap)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm leading-snug text-foreground">{item.message}</p>
              <p className="mt-0.5 text-2xs text-muted-foreground">{formatDate(item.createdAt, "MMM d · h:mm a")}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
