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
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { createExpenseAction } from "@/features/expenses/actions";

const METHODS = ["CASH", "CREDIT_CARD", "DEBIT_CARD", "BANK_TRANSFER", "CHECK", "OTHER"];

export function ExpenseDialog({
  organizationSlug,
  categories,
  clients,
  projects,
  defaultOpen,
}: {
  organizationSlug: string;
  categories: { id: string; name: string }[];
  clients: { id: string; companyName: string }[];
  projects: { id: string; name: string; clientId: string }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [method, setMethod] = useState("CREDIT_CARD");
  const [taxDeductible, setTaxDeductible] = useState(true);
  const [isPersonal, setIsPersonal] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const filteredProjects = clientId ? projects.filter((p) => p.clientId === clientId) : projects;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New expense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New expense</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (categoryId) fd.set("categoryId", categoryId);
            if (clientId) fd.set("clientId", clientId);
            if (projectId) fd.set("projectId", projectId);
            fd.set("paymentMethod", method);
            fd.set("taxDeductible", taxDeductible ? "on" : "");
            fd.set("isPersonal", isPersonal ? "on" : "");
            start(async () => {
              const res = await createExpenseAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Expense recorded");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Description" required className="md:col-span-2">
              <Input name="description" required />
            </Field>
            <Field label="Amount" required>
              <Input name="amount" type="number" step="0.01" min="0.01" required />
            </Field>
            <Field label="Date" required>
              <Input name="date" type="date" defaultValue={today} required />
            </Field>
            <Field label="Category">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Payment method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Vendor (optional)">
              <Input name="vendorName" />
            </Field>
            <Field label="Client (optional)">
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Project (optional)">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {filteredProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Tax deductible</div>
                <div className="text-xs text-muted-foreground">Counted against operating profit.</div>
              </div>
              <Switch checked={taxDeductible} onCheckedChange={setTaxDeductible} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Personal</div>
                <div className="text-xs text-muted-foreground">Excluded from business totals.</div>
              </div>
              <Switch checked={isPersonal} onCheckedChange={setIsPersonal} />
            </div>
            <Field label="Notes" className="md:col-span-2">
              <Textarea name="notes" rows={2} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
