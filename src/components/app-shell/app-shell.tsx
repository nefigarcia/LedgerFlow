"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users2,
  FolderKanban,
  Clock,
  FileText,
  CreditCard,
  Receipt,
  Wallet,
  Calculator,
  HandCoins,
  TrendingUp,
  BarChart3,
  FolderOpen,
  Sparkles,
  Settings,
  Plus,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ChevronsUpDown,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import type { OrganizationRole } from "@prisma/client";
import { hasPermission } from "@/lib/permissions/permissions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requires?: Parameters<typeof hasPermission>[1];
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cash", href: "/cash", icon: Wallet },
  { label: "Clients", href: "/clients", icon: Users2, requires: "clients:read" },
  { label: "Projects", href: "/projects", icon: FolderKanban, requires: "projects:read" },
  { label: "Time", href: "/time", icon: Clock, requires: "time:read" },
  { label: "Invoices", href: "/invoices", icon: FileText, requires: "invoices:read" },
  { label: "Payments", href: "/payments", icon: CreditCard, requires: "payments:read" },
  { label: "Expenses", href: "/expenses", icon: Receipt, requires: "expenses:read" },
  { label: "Taxes", href: "/taxes", icon: Calculator, requires: "taxes:read" },
  { label: "Distributions", href: "/distributions", icon: HandCoins, requires: "distributions:read" },
  { label: "Forecast", href: "/forecast", icon: TrendingUp, requires: "reports:read" },
  { label: "Reports", href: "/reports", icon: BarChart3, requires: "reports:read" },
  { label: "Documents", href: "/documents", icon: FolderOpen },
  { label: "Assistant", href: "/assistant", icon: Sparkles, requires: "ai:use" },
  { label: "Settings", href: "/settings", icon: Settings, requires: "settings:read" },
];

interface Props {
  organization: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    logoUrl: string | null;
  };
  role: OrganizationRole;
  memberships: { id: string; name: string; slug: string }[];
  children: React.ReactNode;
}

export function AppShell({ organization, role, memberships, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  const base = `/app/${organization.slug}`;

  const items = NAV.filter((i) => !i.requires || hasPermission(role, i.requires));

  const NavContent = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {items.map((item) => {
        const href = base + item.href;
        const active =
          pathname === href ||
          (pathname.startsWith(href + "/") && item.href !== "/dashboard");
        return (
          <Link
            key={item.href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const OrgSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center justify-between gap-2 rounded-md border bg-card p-2 text-left text-sm hover:bg-accent">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
              {initials(organization.name)}
            </span>
            <span className="min-w-0 truncate font-medium">{organization.name}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {memberships.map((m) => (
          <DropdownMenuItem key={m.id} asChild>
            <Link href={`/app/${m.slug}/dashboard`}>{m.name}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?new=1">
            <Plus className="mr-2 h-4 w-4" /> Add new business
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Link href={`${base}/dashboard`}>
            <BrandMark />
          </Link>
        </div>
        <div className="p-3">{OrgSwitcher}</div>
        {NavContent}
        <div className="border-t p-3">
          <QuickActionMenu base={base} />
        </div>
      </aside>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-card">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <BrandMark />
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-3">{OrgSwitcher}</div>
            {NavContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <QuickActionMenu base={base} compact />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials("").toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`${base}/settings`}>Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut({ redirect: false });
                    router.push("/login");
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function QuickActionMenu({ base, compact }: { base: string; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={compact ? "sm" : "default"} className={cn(compact ? "" : "w-full")}>
          <Plus className="h-4 w-4" /> {compact ? "New" : "Create"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} className="w-56">
        <DropdownMenuItem asChild><Link href={`${base}/invoices/new`}>New invoice</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`${base}/payments?new=1`}>Record payment</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`${base}/expenses?new=1`}>New expense</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`${base}/clients?new=1`}>New client</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`${base}/projects?new=1`}>New project</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`${base}/time?new=1`}>Add time</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`${base}/distributions?new=1`}>Owner distribution</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
