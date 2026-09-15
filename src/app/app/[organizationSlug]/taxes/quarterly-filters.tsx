"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function QuarterlyPlannerFilters({
  basePath,
  owners,
  activeOwner,
  activeAuthority,
  year,
}: {
  basePath: string;
  owners: { id: string; name: string }[];
  activeOwner: string;
  activeAuthority: string;
  year: number;
}) {
  const searchParams = useSearchParams();
  const buildHref = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "" || v === "all") p.delete(k);
      else p.set(k, v);
    }
    return `${basePath}?${p.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterGroup label="Owner">
        <Chip href={buildHref({ owner: null })} active={activeOwner === "all"}>All</Chip>
        <Chip href={buildHref({ owner: "org" })} active={activeOwner === "org"}>Organization</Chip>
        {owners.map((o) => (
          <Chip key={o.id} href={buildHref({ owner: o.id })} active={activeOwner === o.id}>{o.name}</Chip>
        ))}
      </FilterGroup>
      <FilterGroup label="Authority">
        {[
          { key: "all", label: "All" },
          { key: "IRS", label: "IRS" },
          { key: "STATE", label: "State" },
          { key: "LOCAL", label: "Local" },
          { key: "OTHER", label: "Other" },
        ].map((a) => (
          <Chip key={a.key} href={buildHref({ authority: a.key })} active={activeAuthority === a.key}>{a.label}</Chip>
        ))}
      </FilterGroup>
      <FilterGroup label="Year">
        {[year - 1, year, year + 1].map((y) => (
          <Chip key={y} href={buildHref({ year: String(y) })} active={y === year}>{y}</Chip>
        ))}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-surface p-1">{children}</div>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary-soft text-primary-soft-foreground"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
