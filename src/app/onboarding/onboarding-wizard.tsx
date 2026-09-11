"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/lib/brand";
import { createOrganizationAction } from "@/features/organizations/actions";
import { Plus, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const BUSINESS_TYPES = [
  { value: "SOLE_PROPRIETORSHIP", label: "Sole proprietorship" },
  { value: "SINGLE_MEMBER_LLC", label: "Single-member LLC" },
  { value: "MULTI_MEMBER_LLC", label: "Multi-member LLC" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "S_CORP", label: "S-Corp" },
  { value: "C_CORP", label: "C-Corp" },
  { value: "OTHER", label: "Other" },
] as const;

const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "MXN"];

const STEP1_FIELDS = new Set([
  "name", "legalName", "businessType", "country", "state", "currency", "timezone",
  "fiscalYearStartMonth", "taxIdLastFour", "addressLine1", "addressCity",
  "addressState", "addressPostalCode", "phone", "website",
]);
const STEP3_FIELDS = new Set([
  "invoicePrefix", "invoiceNextNumber", "defaultPaymentTermsDays",
  "defaultTaxReserveRate", "openingBalance",
]);

const FIELD_LABELS: Record<string, string> = {
  name: "Business name",
  legalName: "Legal name",
  businessType: "Business type",
  country: "Country",
  state: "State/Province",
  currency: "Currency",
  timezone: "Timezone",
  fiscalYearStartMonth: "Fiscal year start month",
  taxIdLastFour: "Tax ID last four",
  addressLine1: "Address",
  addressCity: "City",
  addressState: "Address state",
  addressPostalCode: "Postal code",
  phone: "Phone",
  website: "Website",
  invoicePrefix: "Invoice prefix",
  invoiceNextNumber: "Next invoice number",
  defaultPaymentTermsDays: "Payment terms",
  defaultTaxReserveRate: "Tax reserve %",
  openingBalance: "Opening balance",
  owners: "Owners",
};

function labelForPath(path: string): string {
  if (path in FIELD_LABELS) return FIELD_LABELS[path];
  const m = path.match(/^owners\.(\d+)\.(.+)$/);
  if (m) {
    const idx = Number(m[1]) + 1;
    const sub = m[2];
    const subLabel: Record<string, string> = {
      name: "name",
      email: "email",
      ownershipPercentage: "ownership %",
      distributionPercentage: "distribution %",
      taxReserveOverride: "tax reserve override",
    };
    return `Owner ${idx} ${subLabel[sub] ?? sub}`;
  }
  return path;
}

interface OwnerRow {
  name: string;
  email: string;
  ownershipPercentage: number;
  distributionPercentage: number;
}

interface WizardState {
  name: string;
  legalName: string;
  businessType: string;
  country: string;
  state: string;
  currency: string;
  timezone: string;
  fiscalYearStartMonth: number;
  taxIdLastFour: string;
  addressLine1: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  phone: string;
  website: string;
  invoicePrefix: string;
  invoiceNextNumber: number;
  defaultPaymentTermsDays: number;
  defaultTaxReserveRate: number;
  openingBalance: number;
  owners: OwnerRow[];
}

export function OnboardingWizard({ userName }: { userName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<{
    message: string;
    fieldErrors?: Record<string, string[]>;
  } | null>(null);
  const [state, setState] = useState<WizardState>({
    name: "",
    legalName: "",
    businessType: "SINGLE_MEMBER_LLC",
    country: "US",
    state: "",
    currency: "USD",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    fiscalYearStartMonth: 1,
    taxIdLastFour: "",
    addressLine1: "",
    addressCity: "",
    addressState: "",
    addressPostalCode: "",
    phone: "",
    website: "",
    invoicePrefix: "INV",
    invoiceNextNumber: 1,
    defaultPaymentTermsDays: 14,
    defaultTaxReserveRate: 25,
    openingBalance: 0,
    owners: [
      { name: userName, email: "", ownershipPercentage: 100, distributionPercentage: 100 },
    ],
  });

  const ownershipTotal = useMemo(
    () => state.owners.reduce((s, o) => s + Number(o.ownershipPercentage || 0), 0),
    [state.owners],
  );
  const distributionTotal = useMemo(
    () => state.owners.reduce((s, o) => s + Number(o.distributionPercentage || 0), 0),
    [state.owners],
  );

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  function updateOwner(index: number, patch: Partial<OwnerRow>) {
    setState((prev) => ({
      ...prev,
      owners: prev.owners.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }

  function addOwner() {
    setState((prev) => ({
      ...prev,
      owners: [
        ...prev.owners,
        { name: "", email: "", ownershipPercentage: 0, distributionPercentage: 0 },
      ],
    }));
  }

  function removeOwner(index: number) {
    setState((prev) => ({
      ...prev,
      owners: prev.owners.length > 1 ? prev.owners.filter((_, i) => i !== index) : prev.owners,
    }));
  }

  function goSubmit() {
    setSubmitError(null);
    start(async () => {
      const res = await createOrganizationAction(state);
      if (!res.success) {
        setSubmitError({
          message: res.error.message,
          fieldErrors: res.error.fieldErrors,
        });
        toast.error(res.error.message);
        // If the failure is in an earlier step, jump the user back to fix it.
        const firstBadField = Object.keys(res.error.fieldErrors ?? {})[0];
        if (firstBadField) {
          if (firstBadField.startsWith("owners")) setStep(2);
          else if (STEP1_FIELDS.has(firstBadField)) setStep(1);
          else if (STEP3_FIELDS.has(firstBadField)) setStep(3);
        }
        return;
      }
      toast.success("Business created");
      router.push(`/app/${res.data.organizationSlug}/dashboard`);
      router.refresh();
    });
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 -z-10 bg-gradient-to-b from-primary-soft/40 to-transparent" aria-hidden />
      <header className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <BrandMark />
          <p className="hidden text-2xs uppercase tracking-widest text-muted-foreground md:block">{BRAND.tagline}</p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 text-center">
          <div className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Set up your workspace</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Let&apos;s get your business in shape.</h1>
        </div>
        <div className="mb-8 flex items-center justify-center gap-2 text-sm">
          {["Business", "Owners", "Defaults", "Finish"].map((label, i) => {
            const s = i + 1;
            const active = step === s;
            const done = step > s;
            return (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-medium transition-colors ${
                    done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
                </span>
                <span className={active ? "text-sm font-medium" : "hidden text-sm text-muted-foreground sm:inline"}>{label}</span>
                {s < 4 ? <span className="mx-1 hidden text-muted-foreground sm:inline">›</span> : null}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Tell us about your business</CardTitle>
              <CardDescription>You can change any of this later in settings.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Business name" required>
                <Input value={state.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Legal name (optional)">
                <Input value={state.legalName} onChange={(e) => set("legalName", e.target.value)} />
              </Field>
              <Field label="Business type" required>
                <Select value={state.businessType} onValueChange={(v) => set("businessType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Country">
                <Input value={state.country} onChange={(e) => set("country", e.target.value.toUpperCase().slice(0, 2))} />
              </Field>
              <Field label="State / Province">
                <Input value={state.state} onChange={(e) => set("state", e.target.value)} />
              </Field>
              <Field label="Currency">
                <Select value={state.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Timezone">
                <Input value={state.timezone} onChange={(e) => set("timezone", e.target.value)} />
              </Field>
              <Field label="Fiscal year start month" hint="1 = January">
                <Input type="number" min={1} max={12} value={state.fiscalYearStartMonth} onChange={(e) => set("fiscalYearStartMonth", Number(e.target.value))} />
              </Field>
              <Field label="Tax ID last four (optional)">
                <Input value={state.taxIdLastFour} onChange={(e) => set("taxIdLastFour", e.target.value.slice(0, 4))} />
              </Field>
              <Field label="Phone (optional)">
                <Input value={state.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label="Website (optional)" className="md:col-span-2">
                <Input value={state.website} onChange={(e) => set("website", e.target.value)} />
              </Field>
              <Field label="Address line 1" className="md:col-span-2">
                <Input value={state.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
              </Field>
              <Field label="City">
                <Input value={state.addressCity} onChange={(e) => set("addressCity", e.target.value)} />
              </Field>
              <Field label="Postal code">
                <Input value={state.addressPostalCode} onChange={(e) => set("addressPostalCode", e.target.value)} />
              </Field>
            </CardContent>
            <div className="flex justify-between border-t px-6 py-4">
              <Button variant="ghost" disabled>Back</Button>
              <Button onClick={() => setStep(2)} disabled={!state.name.trim()}>Continue</Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Owners</CardTitle>
              <CardDescription>
                Add each owner and their ownership share. Distribution percentages default to ownership.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Badge variant={Math.abs(ownershipTotal - 100) < 0.01 ? "success" : "warning"}>
                  Ownership total: {ownershipTotal.toFixed(2)}%
                </Badge>
                <Badge variant={Math.abs(distributionTotal - 100) < 0.01 ? "success" : "warning"}>
                  Distribution total: {distributionTotal.toFixed(2)}%
                </Badge>
              </div>
              <div className="space-y-3">
                {state.owners.map((o, i) => (
                  <div key={i} className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-[1.5fr_1.5fr_1fr_1fr_auto]">
                    <Field label={i === 0 ? "Name" : undefined}>
                      <Input value={o.name} onChange={(e) => updateOwner(i, { name: e.target.value })} required />
                    </Field>
                    <Field label={i === 0 ? "Email" : undefined}>
                      <Input type="email" value={o.email} onChange={(e) => updateOwner(i, { email: e.target.value })} />
                    </Field>
                    <Field label={i === 0 ? "Ownership %" : undefined}>
                      <Input
                        type="number"
                        step="0.01"
                        value={o.ownershipPercentage}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          updateOwner(i, {
                            ownershipPercentage: v,
                            distributionPercentage: o.distributionPercentage || v,
                          });
                        }}
                      />
                    </Field>
                    <Field label={i === 0 ? "Distribution %" : undefined}>
                      <Input type="number" step="0.01" value={o.distributionPercentage} onChange={(e) => updateOwner(i, { distributionPercentage: Number(e.target.value) })} />
                    </Field>
                    <div className="flex items-end">
                      <Button variant="ghost" size="icon" type="button" onClick={() => removeOwner(i)} disabled={state.owners.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" type="button" onClick={addOwner}>
                <Plus className="h-4 w-4" /> Add owner
              </Button>
            </CardContent>
            <div className="flex justify-between border-t px-6 py-4">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={
                  state.owners.some((o) => !o.name.trim()) ||
                  Math.abs(ownershipTotal - 100) > 0.01 ||
                  Math.abs(distributionTotal - 100) > 0.01
                }
              >
                Continue
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Financial defaults</CardTitle>
              <CardDescription>These become the defaults for invoices and tax planning.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Invoice prefix" hint="Example: ODW → ODW-2026-001">
                <Input value={state.invoicePrefix} onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase())} maxLength={10} />
              </Field>
              <Field label="Next invoice number">
                <Input type="number" min={1} value={state.invoiceNextNumber} onChange={(e) => set("invoiceNextNumber", Math.max(1, Number(e.target.value)))} />
              </Field>
              <Field label="Default payment terms (days)">
                <Input type="number" min={0} max={365} value={state.defaultPaymentTermsDays} onChange={(e) => set("defaultPaymentTermsDays", Number(e.target.value))} />
              </Field>
              <Field label="Default tax reserve %" hint="Percentage of estimated profit to set aside for taxes.">
                <Input type="number" step="0.5" min={0} max={100} value={state.defaultTaxReserveRate} onChange={(e) => set("defaultTaxReserveRate", Number(e.target.value))} />
              </Field>
              <Field label="Opening cash balance" hint="Starting cash on hand. You can update this later.">
                <Input type="number" step="0.01" value={state.openingBalance} onChange={(e) => set("openingBalance", Number(e.target.value))} />
              </Field>
            </CardContent>
            <div className="flex justify-between border-t px-6 py-4">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)}>Continue</Button>
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Ready when you are</CardTitle>
              <CardDescription>
                We&apos;ll create your workspace, set up default expense categories, and take you to the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {submitError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>We couldn&apos;t create your workspace</AlertTitle>
                  <AlertDescription>
                    {submitError.fieldErrors && Object.keys(submitError.fieldErrors).length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {Object.entries(submitError.fieldErrors).map(([path, msgs]) => (
                          <li key={path}>
                            <span className="font-medium">{labelForPath(path)}</span>
                            {": "}
                            {msgs[0]}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1">{submitError.message}</p>
                    )}
                  </AlertDescription>
                </Alert>
              ) : null}
              <p>Business: <span className="text-foreground">{state.name || "—"}</span></p>
              <p>Owners: <span className="text-foreground">{state.owners.length}</span></p>
              <p>Currency: <span className="text-foreground">{state.currency}</span></p>
              <p>Tax reserve rate: <span className="text-foreground">{state.defaultTaxReserveRate}%</span></p>
            </CardContent>
            <div className="flex justify-between border-t px-6 py-4">
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={goSubmit} disabled={pending}>
                {pending ? "Creating…" : "Create workspace"}
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
