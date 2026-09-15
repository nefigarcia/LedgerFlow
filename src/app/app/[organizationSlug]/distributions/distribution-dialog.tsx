"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Plus } from "lucide-react";
import { recordDistributionAction } from "@/features/distributions/actions";
import { formatMoney } from "@/lib/money/money";

interface OverSafeData {
  safeAvailable: number;
  attempted: number;
  wouldExceedBy: number;
}

export function DistributionDialog({
  organizationSlug,
  owners,
  currency = "USD",
  defaultOpen,
}: {
  organizationSlug: string;
  owners: { id: string; name: string }[];
  currency?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [overSafe, setOverSafe] = useState<OverSafeData | null>(null);
  const [pendingForm, setPendingForm] = useState<FormData | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const submit = (fd: FormData) => {
    start(async () => {
      const res = await recordDistributionAction(organizationSlug, fd);
      if ("success" in res && res.success) {
        toast.success("Distribution recorded");
        setOpen(false);
        setOverSafe(null);
        setPendingForm(null);
        router.refresh();
        return;
      }
      if ("error" in res && res.error.code === "OVER_SAFE_CONFIRMATION_REQUIRED" && "overSafe" in res.error) {
        setOverSafe(res.error.overSafe);
        return;
      }
      toast.error(res.error.message);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setOverSafe(null);
          setPendingForm(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Record distribution</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record distribution</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("ownerId", ownerId);
            setPendingForm(fd);
            submit(fd);
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Owner" required className="md:col-span-2">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount" required>
              <Input name="amount" type="number" step="0.01" min="0.01" required />
            </Field>
            <Field label="Date" required>
              <Input name="date" type="date" defaultValue={today} required />
            </Field>
            <Field label="Method">
              <Input name="method" placeholder="Transfer, check…" />
            </Field>
            <Field label="Reference">
              <Input name="reference" />
            </Field>
            <Field label="Memo" className="md:col-span-2">
              <Textarea name="memo" rows={2} />
            </Field>
          </div>

          {overSafe ? (
            <Alert variant="warning" className="mt-4 border-warning/40 bg-warning-soft/40">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Exceeds safe-to-distribute</AlertTitle>
              <AlertDescription className="mt-1 space-y-1 text-xs">
                <div>
                  Safe to distribute right now: <span className="num font-semibold">{formatMoney(overSafe.safeAvailable, currency)}</span>
                </div>
                <div>
                  Attempted: <span className="num font-semibold">{formatMoney(overSafe.attempted, currency)}</span>
                </div>
                <div>
                  This distribution exceeds it by <span className="num font-semibold">{formatMoney(overSafe.wouldExceedBy, currency)}</span> and may use cash reserved for taxes or operations.
                </div>
                <div className="pt-2">
                  Confirm to proceed anyway. This action is logged.
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            {overSafe ? (
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (!pendingForm) return;
                  const fd = new FormData();
                  for (const [k, v] of pendingForm.entries()) fd.set(k, v as string);
                  fd.set("confirmOverSafe", "true");
                  submit(fd);
                }}
              >
                {pending ? "Recording…" : "Confirm & record"}
              </Button>
            ) : (
              <Button type="submit" disabled={pending || !ownerId}>{pending ? "Saving…" : "Record"}</Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
