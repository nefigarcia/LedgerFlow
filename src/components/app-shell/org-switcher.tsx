"use client";
import * as React from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initials } from "@/lib/utils";

interface Membership {
  id: string;
  name: string;
  slug: string;
}

export function OrgSwitcher({
  organization,
  memberships,
  role,
  collapsed,
}: {
  organization: { id: string; name: string; slug: string };
  memberships: Membership[];
  role?: string;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-primary to-primary-hover text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-90"
            aria-label={`Workspace: ${organization.name}`}
          >
            {initials(organization.name)}
          </button>
        </DropdownMenuTrigger>
        <OrgMenu current={organization} memberships={memberships} role={role} />
      </DropdownMenu>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-lg border border-border/60 bg-surface px-2 py-2 text-left transition-colors",
            "hover:border-border-strong hover:bg-surface-hover",
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-primary to-primary-hover text-primary-foreground text-xs font-semibold shadow-sm">
            {initials(organization.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{organization.name}</span>
            {role ? (
              <span className="block text-2xs uppercase tracking-widest text-muted-foreground">
                {role.toLowerCase()}
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <OrgMenu current={organization} memberships={memberships} role={role} />
    </DropdownMenu>
  );
}

function OrgMenu({
  current,
  memberships,
  role,
}: {
  current: { id: string; slug: string; name: string };
  memberships: Membership[];
  role?: string;
}) {
  return (
    <DropdownMenuContent align="start" className="w-64">
      <DropdownMenuLabel className="text-2xs uppercase tracking-widest text-muted-foreground">
        Workspaces
      </DropdownMenuLabel>
      {memberships.map((m) => (
        <DropdownMenuItem key={m.id} asChild>
          <Link href={`/app/${m.slug}/dashboard`} className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-2xs font-semibold text-primary">
              {initials(m.name)}
            </span>
            <span className="min-w-0 flex-1 truncate">{m.name}</span>
            {m.id === current.id ? <Check className="h-3.5 w-3.5 text-muted-foreground" /> : null}
          </Link>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/onboarding?new=1" className="text-sm">
          <Plus className="mr-2 h-4 w-4" /> Add new business
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={`/app/${current.slug}/settings`} className="text-sm text-muted-foreground">
          Workspace settings
        </Link>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
