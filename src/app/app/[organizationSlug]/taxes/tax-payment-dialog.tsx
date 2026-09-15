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

interface Props {
  organizationSlug: string;
  owners: { id: string; name: string }[];
  currentYear: number;
  defaultOwnerId?: string;
  triggerLabel?: string;
  size?: "sm" | "default";
}

export function TaxPaymentDialog({
  organizationSlug,
  owners,
  currentYear,
  defaultOwnerId,
  triggerLabel = "Add payment",
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState<string>(defaultOwnerId ?? "ORG");
  const [authority, setAuthority] = useState("IRS");
  const [taxPeriod, setTaxPeriod] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={size === "sm" ? "outline" : "default"} size={size}>
          <Plus className="h-3.5 w-3.5" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record tax payment</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("authority", authority);
            fd.set("ownerId", ownerId);
            if (taxPeriod) fd.set("taxPeriod", taxPeriod); else fd.delete("taxPeriod");
            start(async () => {
              const res = await upsertTaxPaymentAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Tax payment recorded");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Scope" hint="Attach to an owner for pass-through estimated taxes." className="md:col-span-2">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORG">Organization-level (e.g. franchise / sales tax)</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name} — pass-through estimated tax</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Authority">
              <Select value={authority} onValueChange={setAuthority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["IRS", "STATE", "LOCAL", "OTHER"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Jurisdiction">
              <Input name="jurisdiction" placeholder="e.g. Federal, UT" />
            </Field>
            <Field label="Tax year">
              <Input name="taxYear" type="number" min={2000} max={2999} defaultValue={currentYear} />
            </Field>
            <Field label="Period" hint="Q1, Q2, Q3, Q4, Annual…">
              <Select value={taxPeriod} onValueChange={setTaxPeriod}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {["Q1", "Q2", "Q3", "Q4", "Annual", "Extension"].map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Input name="description" placeholder="e.g. Q1 estimated tax" />
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
            <Field label="Reference" className="md:col-span-2">
              <Input name="reference" placeholder="Confirmation number, check #" />
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
