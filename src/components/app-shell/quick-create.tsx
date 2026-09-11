"use client";
import * as React from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  FileText, CreditCard, Receipt, Users2, FolderKanban, Clock, HandCoins, Plus,
} from "lucide-react";

export function QuickCreate({ base, compact = false }: { base: string; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={compact ? "sm" : "default"} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-2xs uppercase tracking-widest text-muted-foreground">
          Quick create
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`${base}/invoices/new`}><FileText className="mr-2 h-4 w-4" /> Invoice</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}/expenses?new=1`}><Receipt className="mr-2 h-4 w-4" /> Expense</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}/payments?new=1`}><CreditCard className="mr-2 h-4 w-4" /> Payment</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${base}/clients?new=1`}><Users2 className="mr-2 h-4 w-4" /> Client</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}/projects?new=1`}><FolderKanban className="mr-2 h-4 w-4" /> Project</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}/time?new=1`}><Clock className="mr-2 h-4 w-4" /> Time entry</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${base}/distributions?new=1`}><HandCoins className="mr-2 h-4 w-4" /> Owner distribution</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
