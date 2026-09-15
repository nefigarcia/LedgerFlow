"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import {
  updateReserveRateAction,
  updateTaxReserveEarmarkedAction,
  updatePlanningModeAction,
  updateOwnerTaxProfileAction,
} from "@/features/taxes/actions";

interface OrgProps {
  currency: string;
  taxPlanningMode: string;
  taxPlanningYear: number;
  defaultTaxReserveRate: string;
  taxReserveEarmarked: string;
  businessType: string;
}

interface OwnerProps {
  id: string;
  name: string;
  ownershipPercentage: string;
  taxReserveOverride: string | null;
  stateReserveRate: string | null;
  residenceState: string | null;
  filingStatus: string | null;
}

const FILING_STATUSES = [
  { value: "", label: "—" },
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED_JOINT", label: "Married filing jointly" },
  { value: "MARRIED_SEPARATE", label: "Married filing separately" },
  { value: "HEAD_OF_HOUSEHOLD", label: "Head of household" },
  { value: "QUALIFYING_SURVIVING_SPOUSE", label: "Qualifying surviving spouse" },
];

export function TaxPlanningSettings({
  organizationSlug,
  org,
  owners,
}: {
  organizationSlug: string;
  org: OrgProps;
  owners: OwnerProps[];
}) {
  return (
    <div className="space-y-4">
      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Tax reserve = money you plan to set aside for future taxes. Tax payment = money actually sent to a tax authority.
          Moving cash to a savings account is not a tax payment.
        </AlertDescription>
      </Alert>

      <OrgTaxCard organizationSlug={organizationSlug} org={org} />

      <Card>
        <CardHeader>
          <CardTitle>Per-owner planning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {owners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add owners on the Owners tab first.</p>
          ) : (
            owners.map((o) => (
              <OwnerTaxRow key={o.id} organizationSlug={organizationSlug} owner={o} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrgTaxCard({ organizationSlug, org }: { organizationSlug: string; org: OrgProps }) {
  const [mode, setMode] = useState(org.taxPlanningMode);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card>
      <CardHeader><CardTitle>Organization tax defaults</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Planning mode */}
        <div>
          <div className="text-sm font-medium">Planning mode</div>
          <p className="mb-2 mt-0.5 text-2xs text-muted-foreground">
            Simple = one reserve rate. Advanced = per-owner state/filing overrides.
          </p>
          <div className="flex items-center gap-2">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMPLE">Simple reserve</SelectItem>
                <SelectItem value="ADVANCED">Advanced (per-owner)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={pending || mode === org.taxPlanningMode}
              onClick={() => {
                const fd = new FormData();
                fd.set("mode", mode);
                start(async () => {
                  const res = await updatePlanningModeAction(organizationSlug, fd);
                  if (!res.success) { toast.error(res.error.message); return; }
                  toast.success("Planning mode updated");
                  router.refresh();
                });
              }}
            >
              Save
            </Button>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium">Business type</div>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {org.businessType.replace(/_/g, " ").toLowerCase()}
          </p>
        </div>

        {/* Default reserve rate */}
        <form
          className="rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await updateReserveRateAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Reserve rate updated");
              router.refresh();
            });
          }}
        >
          <Field label="Default reserve %" hint="Applied to allocated profit for planning targets.">
            <Input name="reserveRate" type="number" step="0.5" min={0} max={100} defaultValue={org.defaultTaxReserveRate} required />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </form>

        {/* Earmarked cash */}
        <form
          className="rounded-md border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await updateTaxReserveEarmarkedAction(organizationSlug, fd);
              if (!res.success) { toast.error(res.error.message); return; }
              toast.success("Reserve balance updated");
              router.refresh();
            });
          }}
        >
          <Field label="Cash earmarked for taxes" hint="Balance of a tax-savings account, if any. Doesn't reduce recorded cash.">
            <Input name="earmarkedCash" type="number" step="0.01" min={0} defaultValue={org.taxReserveEarmarked} />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function OwnerTaxRow({ organizationSlug, owner }: { organizationSlug: string; owner: OwnerProps }) {
  const [override, setOverride] = useState<string>(owner.taxReserveOverride ?? "");
  const [stateRate, setStateRate] = useState<string>(owner.stateReserveRate ?? "");
  const [state, setState] = useState<string>(owner.residenceState ?? "");
  const [filing, setFiling] = useState<string>(owner.filingStatus ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-[minmax(120px,1fr)_repeat(4,minmax(0,1fr))_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("taxReserveOverride", override);
        fd.set("stateReserveRate", stateRate);
        fd.set("residenceState", state);
        fd.set("filingStatus", filing);
        start(async () => {
          const res = await updateOwnerTaxProfileAction(organizationSlug, owner.id, fd);
          if (!res.success) { toast.error(res.error.message); return; }
          toast.success(`${owner.name} tax profile updated`);
          router.refresh();
        });
      }}
    >
      <div>
        <div className="text-sm font-semibold">{owner.name}</div>
        <div className="text-2xs text-muted-foreground">{Number(owner.ownershipPercentage)}% owner</div>
      </div>
      <Field label="Reserve override %" hint="Blank = use org default.">
        <Input value={override} onChange={(e) => setOverride(e.target.value)} type="number" step="0.5" min={0} max={100} />
      </Field>
      <Field label="State reserve %" hint="Advanced mode only.">
        <Input value={stateRate} onChange={(e) => setStateRate(e.target.value)} type="number" step="0.5" min={0} max={100} />
      </Field>
      <Field label="Residence state">
        <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="UT" />
      </Field>
      <Field label="Filing status">
        <Select value={filing} onValueChange={setFiling}>
          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {FILING_STATUSES.filter((f) => f.value !== "").map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
