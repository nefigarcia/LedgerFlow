"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteDistributionAction } from "@/features/distributions/actions";
import { formatMoney } from "@/lib/money/money";
import { DistributionDialog, type EditableDistribution } from "./distribution-dialog";

export function DistributionRowActions({
  organizationSlug,
  owners,
  currency,
  distribution,
  ownerName,
}: {
  organizationSlug: string;
  owners: { id: string; name: string }[];
  currency: string;
  distribution: EditableDistribution;
  ownerName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  // The page only lists active owners; keep the current owner selectable
  // even if they've since been deactivated.
  const ownerOptions = owners.some((o) => o.id === distribution.ownerId)
    ? owners
    : [...owners, { id: distribution.ownerId, name: ownerName }];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={pending} aria-label="Distribution actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => {
              const label = `${formatMoney(distribution.amount, currency)} to ${ownerName}`;
              if (!confirm(`Delete the distribution of ${label}? This is recorded in the audit log.`)) return;
              start(async () => {
                const res = await deleteDistributionAction(organizationSlug, distribution.id);
                if (!res.success) { toast.error(res.error.message); return; }
                toast.success("Distribution deleted");
                router.refresh();
              });
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Mounted only while open so the form re-initialises from the row each time. */}
      {editOpen ? (
        <DistributionDialog
          organizationSlug={organizationSlug}
          owners={ownerOptions}
          currency={currency}
          distribution={distribution}
          open
          onOpenChange={setEditOpen}
        />
      ) : null}
    </>
  );
}
