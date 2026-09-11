"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

const FILTERS = [
  { key: "all",     label: "All" },
  { key: "draft",   label: "Draft" },
  { key: "sent",    label: "Sent" },
  { key: "overdue", label: "Overdue" },
  { key: "paid",    label: "Paid" },
] as const;

export function InvoiceFilters({
  activeStatus,
  query,
  basePath,
}: {
  activeStatus: string;
  query: string;
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(query);

  React.useEffect(() => setQ(query), [query]);

  const submitSearch = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q); else params.delete("q");
    router.push(`${basePath}?${params.toString()}`);
  }, [q, router, basePath, searchParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-surface p-1">
        {FILTERS.map((f) => {
          const params = new URLSearchParams(searchParams.toString());
          if (f.key === "all") params.delete("status");
          else params.set("status", f.key);
          const href = `${basePath}?${params.toString()}`;
          const isActive = activeStatus === f.key;
          return (
            <Link
              key={f.key}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-soft text-primary-soft-foreground"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitSearch();
          }}
          onBlur={submitSearch}
          placeholder="Search by number or client…"
          className="pl-8"
        />
      </div>
    </div>
  );
}
