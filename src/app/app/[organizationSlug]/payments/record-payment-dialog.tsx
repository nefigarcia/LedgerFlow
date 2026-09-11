"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordPaymentAction } from "@/features/payments/actions";

const METHODS = ["ACH", "CHECK", "WIRE", "CREDIT_CARD", "CASH", "OTHER"];

interface Props {
  organizationSlug: string;
  openInvoices?: { id: string; invoiceNumber: string; balanceDue: string; clientId: string | null }[];
  clients?: { id: string; companyName: string }[];
  invoiceId?: string;
  invoiceNumber?: string;
  defaultAmount?: string;
  defaultOpen?: boolean;
  triggerLabel?: string;
}

export function RecordPaymentDialog(props: Props) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const [invoiceId, setInvoiceId] = useState(props.invoiceId ?? "");
  const [clientId, setClientId] = useState("");
  const [method, setMethod] = useState("ACH");
  const [pending, start] = useTransition();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const selectedInvoice = props.openInvoices?.find((i) => i.id === invoiceId);
  const amountDefault = props.defaultAmount ?? (selectedInvoice ? selectedInvoice.balanceDue.toString() : "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{props.triggerLabel ?? "Record payment"}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("method", method);
            if (invoiceId) fd.set("invoiceId", invoiceId);
            if (clientId) fd.set("clientId", clientId);
            start(async () => {
              const res = await recordPaymentAction(props.organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Payment recorded");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {props.invoiceId ? (
              <Field label="Invoice" className="md:col-span-2">
                <Input value={props.invoiceNumber ?? props.invoiceId} disabled />
              </Field>
            ) : (
              <Field label="Invoice (optional)" className="md:col-span-2">
                <Select value={invoiceId} onValueChange={setInvoiceId}>
                  <SelectTrigger><SelectValue placeholder="Unlinked payment" /></SelectTrigger>
                  <SelectContent>
                    {props.openInvoices?.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.invoiceNumber} · balance {i.balanceDue.toString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {!props.invoiceId && !invoiceId && props.clients?.length ? (
              <Field label="Client (optional)" className="md:col-span-2">
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {props.clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <Field label="Amount" required>
              <Input name="amount" type="number" step="0.01" min="0.01" defaultValue={amountDefault} required />
            </Field>
            <Field label="Date" required>
              <Input name="date" type="date" defaultValue={today} required />
            </Field>
            <Field label="Method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Reference">
              <Input name="reference" placeholder="Check #, wire ID, etc." />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <Textarea name="notes" rows={2} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Record payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
