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
import { createTimeEntryAction } from "@/features/time/actions";

export function TimeEntryDialog({
  organizationSlug,
  projects,
  defaultOpen,
}: {
  organizationSlug: string;
  projects: { id: string; name: string; client?: { companyName: string } | null }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [billable, setBillable] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Log time</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("projectId", projectId);
            fd.set("billable", billable ? "on" : "");
            start(async () => {
              const res = await createTimeEntryAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Time logged");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Project" required className="md:col-span-2">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.client?.companyName ? `${p.client.companyName} · ` : ""}{p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date" required>
              <Input name="date" type="date" defaultValue={today} required />
            </Field>
            <Field label="Hours" required>
              <Input name="hours" type="number" step="0.25" min="0.25" max="24" required />
            </Field>
            <Field label="Hourly rate (override)">
              <Input name="hourlyRate" type="number" step="0.01" min={0} />
            </Field>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Billable</div>
                <div className="text-xs text-muted-foreground">Unbilled hours can be invoiced later.</div>
              </div>
              <Switch checked={billable} onCheckedChange={setBillable} />
            </div>
            <Field label="Description" className="md:col-span-2">
              <Textarea name="description" rows={3} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !projectId}>{pending ? "Saving…" : "Log time"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
