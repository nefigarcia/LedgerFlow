"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { updateReserveRateAction } from "@/features/taxes/actions";

export function ReserveRateDialog({ organizationSlug, current }: { organizationSlug: string; current: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-2xs font-medium uppercase tracking-widest text-primary hover:underline">Change</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Change reserve rate</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await updateReserveRateAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Reserve rate updated");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <Field label="Reserve rate %">
            <Input name="reserveRate" type="number" step="0.5" min={0} max={100} defaultValue={current} required />
          </Field>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
