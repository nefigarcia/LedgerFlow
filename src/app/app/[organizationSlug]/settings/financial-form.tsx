"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { updateFinancialSettingsAction } from "@/features/settings/actions";

interface FinancialOrg {
  currency: string;
  fiscalYearStartMonth: number;
  openingBalance: string;
  minimumOperatingReserve: string;
  defaultTaxReserveRate: string;
}

export function FinancialSettingsForm({
  organizationSlug,
  org,
}: {
  organizationSlug: string;
  org: FinancialOrg;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card>
      <CardHeader><CardTitle>Financial defaults</CardTitle></CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await updateFinancialSettingsAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Settings saved");
              router.refresh();
            });
          }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <Field label="Currency">
            <Input name="currency" defaultValue={org.currency} maxLength={3} />
          </Field>
          <Field label="Fiscal year start month" hint="1 = January">
            <Input name="fiscalYearStartMonth" type="number" min={1} max={12} defaultValue={org.fiscalYearStartMonth} />
          </Field>
          <Field label="Opening cash balance">
            <Input name="openingBalance" type="number" step="0.01" defaultValue={org.openingBalance.toString()} />
          </Field>
          <Field label="Minimum operating reserve" hint="Cash you always want to keep on hand.">
            <Input name="minimumOperatingReserve" type="number" step="0.01" min={0} defaultValue={org.minimumOperatingReserve.toString()} />
          </Field>
          <Field label="Default tax reserve %">
            <Input name="defaultTaxReserveRate" type="number" step="0.5" min={0} max={100} defaultValue={org.defaultTaxReserveRate.toString()} />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
