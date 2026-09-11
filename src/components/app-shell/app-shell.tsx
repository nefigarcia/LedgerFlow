"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  Menu, X, Sun, Moon, LogOut, Search as SearchIcon, Command as CommandIcon,
  Sparkles, ChevronLeft, ChevronRight, User as UserIcon, Bell, PanelLeftClose, PanelLeft,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { hasPermission } from "@/lib/permissions/permissions";
import type { OrganizationRole } from "@prisma/client";
import { NAV_GROUPS, BOTTOM_NAV } from "./sidebar-nav";
import { OrgSwitcher } from "./org-switcher";
import { QuickCreate } from "./quick-create";
import { CommandPalette } from "./command-palette";

interface AppShellProps {
  organization: { id: string; name: string; slug: string; currency: string; logoUrl: string | null };
  role: OrganizationRole;
  memberships: { id: string; name: string; slug: string }[];
  user?: { name: string | null; email: string | null; image: string | null } | null;
  children: React.ReactNode;
}

export function AppShell({ organization, role, memberships, user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const base = `/app/${organization.slug}`;

  // Persist collapse preference
  React.useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("lf.sidebar.collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("lf.sidebar.collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  // Cmd/Ctrl+K opens palette
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentSection = React.useMemo(() => {
    // Find nav item matching current pathname
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        const href = base + item.href;
        if (pathname === href || pathname.startsWith(href + "/")) return item.label;
      }
    }
    if (pathname.startsWith(base + BOTTOM_NAV.href)) return BOTTOM_NAV.label;
    return organization.name;
  }, [pathname, base, organization.name]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border/70 bg-surface transition-[width] duration-200 md:flex",
            collapsed ? "w-[68px]" : "w-[248px]",
          )}
        >
          <div className={cn("flex h-14 items-center border-b border-border/70", collapsed ? "justify-center px-2" : "justify-between px-4")}>
            <Link href={`${base}/dashboard`} className="focus:outline-none">
              <BrandMark showName={!collapsed} size={collapsed ? "sm" : "md"} />
            </Link>
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                className="rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className={cn("px-3 pt-3", collapsed && "px-2")}>
            <OrgSwitcher organization={organization} memberships={memberships} role={role} collapsed={collapsed} />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {NAV_GROUPS.map((group, gi) => {
              const visibleItems = group.items.filter((i) => !i.requires || hasPermission(role, i.requires));
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.id} className={cn(gi > 0 && "mt-4")}>
                  {group.label && !collapsed ? (
                    <div className="mb-1 px-2 text-2xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                      {group.label}
                    </div>
                  ) : null}
                  <ul className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const href = base + item.href;
                      const active = pathname === href || pathname.startsWith(href + "/");
                      const link = (
                        <Link
                          href={href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "group relative flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                            collapsed ? "h-9 justify-center px-0" : "h-8 px-2",
                            active
                              ? "bg-primary-soft text-primary-soft-foreground"
                              : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                          )}
                        >
                          {active ? (
                            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" aria-hidden />
                          ) : null}
                          <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      );
                      return (
                        <li key={item.href}>
                          {collapsed ? (
                            <Tooltip>
                              <TooltipTrigger asChild>{link}</TooltipTrigger>
                              <TooltipContent side="right">{item.label}</TooltipContent>
                            </Tooltip>
                          ) : link}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>

          <div className={cn("border-t border-border/70 p-3", collapsed && "px-2")}>
            {hasPermission(role, "settings:read") ? (
              collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`${base}${BOTTOM_NAV.href}`}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                        pathname.startsWith(base + BOTTOM_NAV.href) && "bg-primary-soft text-primary",
                      )}
                    >
                      <BOTTOM_NAV.icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{BOTTOM_NAV.label}</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href={`${base}${BOTTOM_NAV.href}`}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors",
                    pathname.startsWith(base + BOTTOM_NAV.href)
                      ? "bg-primary-soft text-primary-soft-foreground"
                      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <BOTTOM_NAV.icon className="h-4 w-4" />
                  {BOTTOM_NAV.label}
                </Link>
              )
            ) : null}
            {collapsed && (
              <button
                onClick={() => setCollapsed(false)}
                className="mt-2 flex h-9 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface animate-in slide-in-from-left duration-200">
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <Link href={`${base}/dashboard`}><BrandMark /></Link>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-3">
                <OrgSwitcher organization={organization} memberships={memberships} role={role} />
              </div>
              <nav className="flex-1 overflow-y-auto px-3 pb-4">
                {NAV_GROUPS.map((group, gi) => {
                  const visibleItems = group.items.filter((i) => !i.requires || hasPermission(role, i.requires));
                  if (visibleItems.length === 0) return null;
                  return (
                    <div key={group.id} className={cn(gi > 0 && "mt-4")}>
                      {group.label ? (
                        <div className="mb-1 px-2 text-2xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                          {group.label}
                        </div>
                      ) : null}
                      <ul className="space-y-0.5">
                        {visibleItems.map((item) => {
                          const href = base + item.href;
                          const active = pathname === href || pathname.startsWith(href + "/");
                          return (
                            <li key={item.href}>
                              <Link
                                href={href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  "flex h-10 items-center gap-2.5 rounded-md px-2 text-sm font-medium",
                                  active
                                    ? "bg-primary-soft text-primary-soft-foreground"
                                    : "text-foreground/70 hover:bg-surface-hover hover:text-foreground",
                                )}
                              >
                                <item.icon className={cn("h-4 w-4", active && "text-primary")} />
                                {item.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </nav>
              <div className="border-t border-border p-3">
                {hasPermission(role, "settings:read") && (
                  <Link
                    href={`${base}${BOTTOM_NAV.href}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex h-10 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-foreground/70 hover:bg-surface-hover"
                  >
                    <BOTTOM_NAV.icon className="h-4 w-4" />
                    Settings
                  </Link>
                )}
              </div>
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top command bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur-md md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div className="hidden items-center gap-1.5 text-sm md:flex">
                <span className="text-muted-foreground">{organization.name}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="font-medium text-foreground">{currentSection}</span>
              </div>
              <div className="md:hidden">
                <BrandMark showName={false} size="sm" />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className={cn(
                  "hidden h-9 items-center gap-2 rounded-md border border-border/70 bg-surface px-2.5 text-sm text-muted-foreground",
                  "hover:border-border-strong hover:text-foreground transition-colors md:flex md:min-w-[240px] lg:min-w-[280px]",
                )}
              >
                <SearchIcon className="h-4 w-4" />
                <span className="flex-1 text-left">Search or jump to…</span>
                <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border/70 bg-background px-1.5 font-mono text-2xs text-muted-foreground">
                  <CommandIcon className="h-3 w-3" /> K
                </kbd>
              </button>

              <Button variant="ghost" size="icon" onClick={() => setPaletteOpen(true)} className="md:hidden">
                <SearchIcon className="h-4 w-4" />
              </Button>

              <Button asChild variant="ghost" size="sm" className="hidden gap-1.5 md:inline-flex">
                <Link href={`${base}/assistant`}>
                  <Sparkles className="h-3.5 w-3.5" /> Ask
                </Link>
              </Button>

              <QuickCreate base={base} compact />

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
                  <button className="ml-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary-hover text-primary-foreground text-xs font-semibold">
                        {initials(user?.name ?? user?.email ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="text-sm font-medium">{user?.name ?? "Account"}</div>
                    {user?.email ? <div className="text-2xs text-muted-foreground">{user.email}</div> : null}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`${base}/settings`}>
                      <UserIcon className="mr-2 h-4 w-4" /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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

          <main className="mx-auto w-full max-w-[1520px] flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>

        <CommandPalette organizationSlug={organization.slug} open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}
