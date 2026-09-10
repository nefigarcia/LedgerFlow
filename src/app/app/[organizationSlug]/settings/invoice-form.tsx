"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { updateInvoiceSettingsAction } from "@/features/settings/actions";

export function InvoiceSettingsForm({
  organizationSlug,
  org,
}: {
  organizationSlug: string;
  org: any;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card>
      <CardHeader><CardTitle>Invoice settings</CardTitle></CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await updateInvoiceSettingsAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Saved");
              router.refresh();
            });
          }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <Field label="Invoice prefix">
            <Input name="invoicePrefix" defaultValue={org.invoicePrefix} maxLength={10} />
          </Field>
          <Field label="Next invoice number">
            <Input name="invoiceNextNumber" type="number" min={1} defaultValue={org.invoiceNextNumber} />
          </Field>
          <Field label="Default payment terms (days)">
            <Input name="defaultPaymentTermsDays" type="number" min={0} max={365} defaultValue={org.defaultPaymentTermsDays} />
          </Field>
          <Field label="Payment instructions (on invoices)" className="md:col-span-2">
            <Textarea name="paymentInstructions" rows={3} />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
