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
import { Plus } from "lucide-react";
import { upsertTaxPaymentAction } from "@/features/taxes/actions";

export function TaxPaymentDialog({ organizationSlug }: { organizationSlug: string }) {
  const [open, setOpen] = useState(false);
  const [authority, setAuthority] = useState("IRS");
  const [pending, start] = useTransition();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="h-4 w-4" /> Add payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Tax payment</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("authority", authority);
            start(async () => {
              const res = await upsertTaxPaymentAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Saved");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Authority">
              <Select value={authority} onValueChange={setAuthority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["IRS", "STATE", "LOCAL", "OTHER"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Jurisdiction">
              <Input name="jurisdiction" placeholder="e.g. Federal, TX" />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Input name="description" placeholder="Q1 estimated tax" />
            </Field>
            <Field label="Due date" required>
              <Input name="dueDate" type="date" defaultValue={today} required />
            </Field>
            <Field label="Paid date">
              <Input name="paidDate" type="date" />
            </Field>
            <Field label="Estimated amount">
              <Input name="estimatedAmount" type="number" step="0.01" min={0} />
            </Field>
            <Field label="Amount paid">
              <Input name="amountPaid" type="number" step="0.01" min={0} />
            </Field>
            <Field label="Reference">
              <Input name="reference" />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <Textarea name="notes" rows={2} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
