"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  FileText,
  CreditCard,
  Receipt,
  HandCoins,
  Users2,
  FolderKanban,
  Clock,
  LayoutDashboard,
  Wallet,
  Calculator,
  Sparkles,
  Settings,
  TrendingUp,
  BarChart3,
  Search as SearchIcon,
} from "lucide-react";

interface SearchResult {
  type: "client" | "project" | "invoice" | "expense";
  id: string;
  primary: string;
  secondary?: string;
  href: string;
}

interface CommandPaletteProps {
  organizationSlug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommandPalette({ organizationSlug, open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const base = `/app/${organizationSlug}`;

  const go = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  // Debounced tenant-scoped search
  React.useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?slug=${encodeURIComponent(organizationSlug)}&q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(data.results ?? []);
        }
      } catch {
        // ignore aborts
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query, open, organizationSlug]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search clients, invoices, expenses… or jump to a page"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query ? (loading ? "Searching…" : "No matches.") : "Start typing or pick an action below."}
        </CommandEmpty>

        {results.length > 0 && (
          <>
            <CommandGroup heading="Search results">
              {results.map((r) => {
                const Icon =
                  r.type === "client" ? Users2 :
                  r.type === "project" ? FolderKanban :
                  r.type === "invoice" ? FileText :
                  Receipt;
                return (
                  <CommandItem key={`${r.type}-${r.id}`} value={`${r.primary} ${r.secondary ?? ""}`} onSelect={() => go(r.href)}>
                    <Icon className="text-muted-foreground" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{r.primary}</span>
                      {r.secondary ? (
                        <span className="truncate text-2xs text-muted-foreground">{r.secondary}</span>
                      ) : null}
                    </div>
                    <span className="text-2xs uppercase tracking-widest text-muted-foreground">{r.type}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Create">
          <CommandItem onSelect={() => go(`${base}/invoices/new`)}>
            <FileText /> Create invoice <CommandShortcut>N I</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go(`${base}/expenses?new=1`)}>
            <Receipt /> New expense
          </CommandItem>
          <CommandItem onSelect={() => go(`${base}/payments?new=1`)}>
            <CreditCard /> Record payment
          </CommandItem>
          <CommandItem onSelect={() => go(`${base}/clients?new=1`)}>
            <Users2 /> Add client
          </CommandItem>
          <CommandItem onSelect={() => go(`${base}/projects?new=1`)}>
            <FolderKanban /> New project
          </CommandItem>
          <CommandItem onSelect={() => go(`${base}/time?new=1`)}>
            <Clock /> Log time
          </CommandItem>
          <CommandItem onSelect={() => go(`${base}/distributions?new=1`)}>
            <HandCoins /> Owner distribution
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Jump to">
          <CommandItem onSelect={() => go(`${base}/dashboard`)}><LayoutDashboard /> Overview</CommandItem>
          <CommandItem onSelect={() => go(`${base}/cash`)}><Wallet /> Cash</CommandItem>
          <CommandItem onSelect={() => go(`${base}/invoices`)}><FileText /> Invoices</CommandItem>
          <CommandItem onSelect={() => go(`${base}/expenses`)}><Receipt /> Expenses</CommandItem>
          <CommandItem onSelect={() => go(`${base}/taxes`)}><Calculator /> Taxes</CommandItem>
          <CommandItem onSelect={() => go(`${base}/distributions`)}><HandCoins /> Distributions</CommandItem>
          <CommandItem onSelect={() => go(`${base}/forecast`)}><TrendingUp /> Forecast</CommandItem>
          <CommandItem onSelect={() => go(`${base}/reports`)}><BarChart3 /> Reports</CommandItem>
          <CommandItem onSelect={() => go(`${base}/assistant`)}><Sparkles /> Assistant</CommandItem>
          <CommandItem onSelect={() => go(`${base}/settings`)}><Settings /> Settings</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
