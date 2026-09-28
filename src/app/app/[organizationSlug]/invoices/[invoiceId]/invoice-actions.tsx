"use client";
import { useTransition } from "react";
import Link from "next/link";
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
import { MoreHorizontal, Send, Ban, Trash2, Copy, Pencil, Printer } from "lucide-react";
import {
  deleteDraftInvoiceAction,
  duplicateInvoiceAction,
  markInvoiceSentAction,
  voidInvoiceAction,
} from "@/features/invoices/actions";

export function InvoiceActions({
  organizationSlug,
  invoiceId,
  status,
  canWrite,
}: {
  organizationSlug: string;
  invoiceId: string;
  status: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const base = `/app/${organizationSlug}`;
  const isDraft = status === "DRAFT";

  return (
    <>
      {isDraft && canWrite ? (
        <Button asChild>
          <Link href={`${base}/invoices/${invoiceId}/edit`}>
            <Pencil className="h-4 w-4" /> Edit draft
          </Link>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={pending} aria-label="More invoice actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <a href={`/api/invoices/${invoiceId}/pdf`} target="_blank" rel="noreferrer">
              <Printer className="mr-2 h-4 w-4" /> Open PDF to print
            </a>
          </DropdownMenuItem>
          {canWrite && isDraft ? (
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
          ) : null}
          {canWrite ? (
            <DropdownMenuItem
              onClick={() =>
                start(async () => {
                  const res = await duplicateInvoiceAction(organizationSlug, invoiceId);
                  if (!res.success) { toast.error(res.error.message); return; }
                  toast.success(`Draft ${res.data.invoiceNumber} created`);
                  router.push(`${base}/invoices/${res.data.id}/edit`);
                })
              }
            >
              <Copy className="mr-2 h-4 w-4" /> Duplicate as new draft
            </DropdownMenuItem>
          ) : null}
          {canWrite && status !== "PAID" && status !== "VOID" && !isDraft ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (!confirm("Void this invoice? It stays in your records but no longer counts as receivable.")) return;
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
            </>
          ) : null}
          {canWrite && isDraft ? (
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
                    router.push(`${base}/invoices`);
                  });
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete draft
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
