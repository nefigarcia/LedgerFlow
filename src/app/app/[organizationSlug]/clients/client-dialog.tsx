"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { createClientAction } from "@/features/clients/actions";

export function ClientDialog({
  organizationSlug,
  defaultOpen,
}: {
  organizationSlug: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> New client</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErrors({});
            start(async () => {
              const res = await createClientAction(organizationSlug, fd);
              if (!res.success) {
                if (res.error.fieldErrors) {
                  const flat: Record<string, string> = {};
                  for (const k in res.error.fieldErrors) flat[k] = res.error.fieldErrors[k][0];
                  setErrors(flat);
                }
                toast.error(res.error.message);
                return;
              }
              toast.success("Client added");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Company name" required error={errors.companyName} className="md:col-span-2">
              <Input name="companyName" required />
            </Field>
            <Field label="Contact name">
              <Input name="contactName" />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input name="email" type="email" />
            </Field>
            <Field label="Phone">
              <Input name="phone" />
            </Field>
            <Field label="Website">
              <Input name="website" />
            </Field>
            <Field label="Address" className="md:col-span-2">
              <Input name="billingAddressLine1" />
            </Field>
            <Field label="City">
              <Input name="billingAddressCity" />
            </Field>
            <Field label="Postal code">
              <Input name="billingAddressPostalCode" />
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <Textarea name="notes" rows={3} />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save client"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
