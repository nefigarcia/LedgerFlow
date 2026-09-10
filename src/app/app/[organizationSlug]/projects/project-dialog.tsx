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
import { createProjectAction } from "@/features/projects/actions";

const BILLING = [
  { value: "HOURLY", label: "Hourly" },
  { value: "FIXED_FEE", label: "Fixed fee" },
  { value: "RETAINER", label: "Retainer" },
  { value: "MILESTONE", label: "Milestone" },
  { value: "MANUAL", label: "Manual" },
];
const STATUS = ["LEAD", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"];

export function ProjectDialog({
  organizationSlug,
  clients,
  defaultOpen,
}: {
  organizationSlug: string;
  clients: { id: string; companyName: string }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? "");
  const [status, setStatus] = useState("ACTIVE");
  const [billing, setBilling] = useState("HOURLY");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("clientId", clientId);
            fd.set("status", status);
            fd.set("billingMethod", billing);
            start(async () => {
              const res = await createProjectAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Project created");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Client" required className="md:col-span-2">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Name" required className="md:col-span-2">
              <Input name="name" required />
            </Field>
            <Field label="Billing method">
              <Select value={billing} onValueChange={setBilling}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BILLING.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Hourly rate">
              <Input name="hourlyRate" type="number" step="0.01" min={0} />
            </Field>
            <Field label="Budget">
              <Input name="budget" type="number" step="0.01" min={0} />
            </Field>
            <Field label="Start date">
              <Input name="startDate" type="date" />
            </Field>
            <Field label="End date">
              <Input name="endDate" type="date" />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea name="description" rows={3} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !clientId}>{pending ? "Saving…" : "Create project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
