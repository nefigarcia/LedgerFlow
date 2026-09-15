"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { updateTaxReserveEarmarkedAction } from "@/features/taxes/actions";

export function EarmarkedReserveDialog({
  organizationSlug,
  current,
}: {
  organizationSlug: string;
  current: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-2xs font-medium uppercase tracking-widest text-primary hover:underline">
          Update
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cash earmarked for taxes</DialogTitle>
          <DialogDescription>
            The amount currently set aside — often the balance of a &quot;tax savings&quot; bank account.
            This does not reduce recorded cash. It only reduces the amount considered freely distributable.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await updateTaxReserveEarmarkedAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Tax reserve balance updated");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <Field label="Earmarked cash">
            <Input name="earmarkedCash" type="number" step="0.01" min={0} defaultValue={current} required />
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
