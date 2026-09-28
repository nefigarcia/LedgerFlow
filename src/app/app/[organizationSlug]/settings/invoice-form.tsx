"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { updateInvoiceSettingsAction } from "@/features/settings/actions";

interface InvoiceOrg {
  invoicePrefix: string;
  invoiceNextNumber: number;
  defaultPaymentTermsDays: number;
  invoicePaymentInstructions: string;
  invoiceDefaultNotes: string;
  invoiceDefaultTerms: string;
}

export function InvoiceSettingsForm({
  organizationSlug,
  org,
}: {
  organizationSlug: string;
  org: InvoiceOrg;
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prefix, setPrefix] = useState(org.invoicePrefix);
  const [nextNumber, setNextNumber] = useState(String(org.invoiceNextNumber));
  const router = useRouter();
  const preview = `${prefix.toUpperCase() || "INV"}-${new Date().getFullYear()}-${String(Number(nextNumber) || 1).padStart(3, "0")}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice settings</CardTitle>
        <p className="text-xs text-muted-foreground">Defaults for new invoices. Each invoice can still be edited while it is a draft.</p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErrors({});
            start(async () => {
              const res = await updateInvoiceSettingsAction(organizationSlug, fd);
              if (!res.success) {
                if (res.error.fieldErrors) {
                  const flat: Record<string, string> = {};
                  for (const k in res.error.fieldErrors) flat[k] = res.error.fieldErrors[k][0];
                  setErrors(flat);
                }
                toast.error(res.error.message);
                return;
              }
              toast.success("Invoice settings saved");
              router.refresh();
            });
          }}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <Field label="Invoice prefix" error={errors.invoicePrefix} hint={`Next number: ${preview}`}>
            <Input name="invoicePrefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={10} required />
          </Field>
          <Field
            label="Next invoice number"
            error={errors.invoiceNextNumber}
            hint="Numbers already in use are skipped automatically."
          >
            <Input name="invoiceNextNumber" type="number" min={1} value={nextNumber} onChange={(e) => setNextNumber(e.target.value)} required />
          </Field>
          <Field label="Default payment terms (days)" error={errors.defaultPaymentTermsDays}>
            <Input name="defaultPaymentTermsDays" type="number" min={0} max={365} defaultValue={org.defaultPaymentTermsDays} required />
          </Field>
          <Field
            label="Payment instructions"
            className="md:col-span-3"
            hint="Printed on every new invoice PDF — bank/ACH details, a payment link, or check address."
            error={errors.paymentInstructions}
          >
            <Textarea name="paymentInstructions" rows={3} maxLength={2000} defaultValue={org.invoicePaymentInstructions} />
          </Field>
          <Field label="Default notes to client" className="md:col-span-3 lg:col-span-1" error={errors.defaultNotes}>
            <Textarea name="defaultNotes" rows={3} maxLength={5000} defaultValue={org.invoiceDefaultNotes} placeholder="Thank you for your business!" />
          </Field>
          <Field label="Default terms" className="md:col-span-3 lg:col-span-2" error={errors.defaultTerms}>
            <Textarea name="defaultTerms" rows={3} maxLength={2000} defaultValue={org.invoiceDefaultTerms} placeholder="Payment due within the terms above." />
          </Field>
          <div className="flex justify-end md:col-span-3">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
