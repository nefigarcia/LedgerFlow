"use client";
import { useTransition } from "react";
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
import { MoreHorizontal, Send, Ban, Trash2 } from "lucide-react";
import {
  deleteDraftInvoiceAction,
  markInvoiceSentAction,
  voidInvoiceAction,
} from "@/features/invoices/actions";

export function InvoiceActions({
  organizationSlug,
  invoiceId,
  status,
}: {
  organizationSlug: string;
  invoiceId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={pending}><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status === "DRAFT" && (
          <DropdownMenuItem
            onClick={() =>
              start(async () => {
                const res = await markInvoiceSentAction(organizationSlug, invoiceId);
                if (!res.success) { toast.error(res.error.message); return; }
                toast.success("Invoice marked sent");
                router.refresh();
              })
            }
          >
            <Send className="mr-2 h-4 w-4" /> Mark as sent
          </DropdownMenuItem>
        )}
        {status !== "PAID" && status !== "VOID" && (
          <DropdownMenuItem
            onClick={() => {
              if (!confirm("Void this invoice? Voided invoices remain in your records but are no longer active.")) return;
              start(async () => {
                const res = await voidInvoiceAction(organizationSlug, invoiceId);
                if (!res.success) { toast.error(res.error.message); return; }
                toast.success("Invoice voided");
                router.refresh();
              });
            }}
          >
            <Ban className="mr-2 h-4 w-4" /> Void invoice
          </DropdownMenuItem>
        )}
        {status === "DRAFT" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (!confirm("Delete this draft invoice? This cannot be undone.")) return;
                start(async () => {
                  const res = await deleteDraftInvoiceAction(organizationSlug, invoiceId);
                  if (!res.success) { toast.error(res.error.message); return; }
                  toast.success("Draft deleted");
                  router.push(`/app/${organizationSlug}/invoices`);
                });
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete draft
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
