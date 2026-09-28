"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { createInvoiceAction, updateDraftInvoiceAction } from "@/features/invoices/actions";
import { formatMoney } from "@/lib/money/money";
import { computeInvoiceTotals, computeItemAmount } from "@/services/invoice-calc";

interface Client { id: string; companyName: string; }
interface Project { id: string; name: string; hourlyRate: string | null; clientId: string; }
interface Item {
  /** Stable key for React; also the server id for items that already exist. */
  key: string;
  id?: string | null;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  projectId?: string | null;
}

export interface InvoiceBuilderInitial {
  clientId: string;
  projectId: string | null;
  issueDate: string;
  dueDate: string;
  poNumber: string;
  notes: string;
  terms: string;
  paymentInstructions: string;
  discount: string;
  taxRate: string;
  items: Omit<Item, "key">[];
}

const UNITS = ["HOURS", "ITEMS", "DAYS", "FLAT", "OTHER"];
const NONE = "__none__";

let keySeq = 0;
const nextKey = () => `row-${++keySeq}`;

/** Inputs can briefly hold partial values; never let the preview throw. */
function safeNumeric(v: string): string {
  return /^-?\d*(\.\d*)?$/.test(v.trim()) && v.trim() !== "" && v.trim() !== "." && v.trim() !== "-" ? v.trim() : "0";
}
function safeAmount(qty: string, rate: string) {
  return computeItemAmount(safeNumeric(qty), safeNumeric(rate));
}

export function InvoiceBuilder({
  organizationSlug,
  currency,
  clients,
  projects,
  defaults,
  initial,
  invoiceId,
  invoiceNumber,
}: {
  organizationSlug: string;
  currency: string;
  clients: Client[];
  projects: Project[];
  defaults: {
    issueDate: string;
    dueDate: string;
    preselectedClientId: string | null;
    notes?: string;
    terms?: string;
    paymentInstructions?: string;
  };
  /** When set, the builder edits this draft instead of creating a new invoice. */
  initial?: InvoiceBuilderInitial;
  invoiceId?: string;
  invoiceNumber?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(invoiceId && initial);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientId, setClientId] = useState<string>(
    initial?.clientId ?? defaults.preselectedClientId ?? clients[0]?.id ?? "",
  );
  const [projectId, setProjectId] = useState<string>(initial?.projectId ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? defaults.issueDate);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? defaults.dueDate);
  const [poNumber, setPoNumber] = useState(initial?.poNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? defaults.notes ?? "");
  const [terms, setTerms] = useState(initial?.terms ?? defaults.terms ?? "");
  const [paymentInstructions, setPaymentInstructions] = useState(
    initial?.paymentInstructions ?? defaults.paymentInstructions ?? "",
  );
  const [discount, setDiscount] = useState(initial?.discount ?? "0");
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? "0");
  const [items, setItems] = useState<Item[]>(() =>
    initial?.items.length
      ? initial.items.map((i) => ({ ...i, key: nextKey() }))
      : [{ key: nextKey(), description: "", quantity: "1", unit: "HOURS", rate: "0", projectId: null }],
  );

  const clientProjects = projects.filter((p) => p.clientId === clientId);
  const selectedProject = projects.find((p) => p.id === projectId);

  // Preview only — the server recomputes every total with decimal math.
  const totals = useMemo(() => {
    const priced = items.map((i) => ({ amount: safeAmount(i.quantity, i.rate) }));
    return computeInvoiceTotals(priced, safeNumeric(discount), safeNumeric(taxRate));
  }, [items, discount, taxRate]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        description: "",
        quantity: "1",
        unit: "HOURS",
        // New rows start at the project's hourly rate when one is set.
        rate: selectedProject?.hourlyRate ?? "0",
        projectId: projectId || null,
      },
    ]);
  }
  function updateItem(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }
  function duplicateItem(key: string) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      if (idx < 0) return prev;
      const copy = { ...prev[idx], key: nextKey(), id: null };
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  }
  function moveItem(key: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function submit() {
    setErrors({});
    const payload = {
      clientId,
      projectId: projectId || null,
      issueDate,
      dueDate,
      poNumber: poNumber || null,
      notes: notes || null,
      terms: terms || null,
      paymentInstructions: paymentInstructions || null,
      discount: discount || "0",
      taxRate: taxRate || "0",
      items: items.map((i) => ({
        id: i.id ?? null,
        description: i.description,
        quantity: i.quantity || "0",
        unit: i.unit,
        rate: i.rate || "0",
        projectId: i.projectId ?? null,
      })),
    };
    start(async () => {
      const res = isEdit
        ? await updateDraftInvoiceAction(organizationSlug, invoiceId!, payload)
        : await createInvoiceAction(organizationSlug, payload);
      if (!res.success) {
        if (res.error.fieldErrors) {
          const flat: Record<string, string> = {};
          for (const k in res.error.fieldErrors) flat[k] = res.error.fieldErrors[k][0];
          setErrors(flat);
        }
        toast.error(res.error.message);
        return;
      }
      toast.success(isEdit ? `Invoice ${res.data.invoiceNumber} saved` : `Invoice ${res.data.invoiceNumber} created`);
      router.push(`/app/${organizationSlug}/invoices/${res.data.id}`);
      router.refresh();
    });
  }

  const canSubmit = !pending && Boolean(clientId) && items.every((i) => i.description.trim());

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Client" required error={errors.clientId}>
              <Select
                value={clientId}
                onValueChange={(v) => {
                  setClientId(v);
                  setProjectId("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Project (optional)">
              <Select value={projectId || NONE} onValueChange={(v) => setProjectId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No project</SelectItem>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Issue date" required error={errors.issueDate}>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </Field>
            <Field label="Due date" required error={errors.dueDate}>
              <Input type="date" value={dueDate} min={issueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </Field>
            <Field label="PO / reference">
              <Input value={poNumber} maxLength={50} onChange={(e) => setPoNumber(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount">
                <Input type="number" step="0.01" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
              <Field label="Sales tax %">
                <Input type="number" step="0.01" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </Field>
            </div>
            <p className="text-2xs text-muted-foreground md:col-span-2">
              Sales tax applies to this customer invoice only. It is separate from income-tax planning and owner tax reserves.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Line items</CardTitle>
              <p className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={addItem} type="button">
              <Plus className="h-4 w-4" /> Add item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60 border-t border-border/70">
              {items.map((it, index) => {
                const amount = safeAmount(it.quantity, it.rate);
                const descError = errors[`items.${index}.description`];
                const fieldId = `item-${it.key}`;
                return (
                  <li key={it.key} className="space-y-3 px-4 py-4">
                    {/* Row 1: description gets the full width at every screen size */}
                    <div className="flex items-start gap-2">
                      <span className="mt-2 w-5 shrink-0 text-right text-2xs font-medium text-muted-foreground num">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`${fieldId}-desc`} className="sr-only">Item {index + 1} description</label>
                        <Textarea
                          id={`${fieldId}-desc`}
                          placeholder="Description of work or product"
                          rows={2}
                          className="min-h-[2.25rem] resize-y py-2"
                          value={it.description}
                          onChange={(e) => updateItem(it.key, { description: e.target.value })}
                        />
                        {descError ? <p className="mt-1 text-xs text-destructive">{descError}</p> : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
                        <Button variant="ghost" size="icon-sm" type="button" aria-label="Move up" disabled={index === 0} onClick={() => moveItem(it.key, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button variant="ghost" size="icon-sm" type="button" aria-label="Move down" disabled={index === items.length - 1} onClick={() => moveItem(it.key, 1)}>
                          <ArrowDown />
                        </Button>
                        <Button variant="ghost" size="icon-sm" type="button" aria-label="Duplicate item" onClick={() => duplicateItem(it.key)}>
                          <Copy />
                        </Button>
                        <Button variant="ghost" size="icon-sm" type="button" aria-label="Remove item" disabled={items.length === 1} onClick={() => removeItem(it.key)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>

                    {/* Row 2: numbers — 2 columns on phones, 4 from small screens up */}
                    <div className="grid grid-cols-2 gap-3 pl-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)]">
                      <div className="space-y-1">
                        <label htmlFor={`${fieldId}-qty`} className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Qty</label>
                        <Input
                          id={`${fieldId}-qty`}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          className="text-right num"
                          value={it.quantity}
                          onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Unit</span>
                        <Select value={it.unit} onValueChange={(v) => updateItem(it.key, { unit: v })}>
                          <SelectTrigger aria-label={`Item ${index + 1} unit`}><SelectValue /></SelectTrigger>
                          <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u.toLowerCase()}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`${fieldId}-rate`} className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Rate</label>
                        <Input
                          id={`${fieldId}-rate`}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          className="text-right num"
                          value={it.rate}
                          onChange={(e) => updateItem(it.key, { rate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1 text-right">
                        <span className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Amount</span>
                        <div className="flex h-9 items-center justify-end text-sm font-semibold num" aria-live="polite">
                          {formatMoney(amount.toString(), currency)}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-border/70 px-4 py-3">
              <Button size="sm" variant="ghost" onClick={addItem} type="button" className="text-muted-foreground">
                <Plus className="h-4 w-4" /> Add another item
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes & payment</CardTitle>
            <p className="text-xs text-muted-foreground">
              Defaults come from Settings → Invoice. Changes here apply to this invoice only.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Payment instructions" className="md:col-span-2" hint="Printed on the PDF, e.g. ACH routing details or a payment link.">
              <Textarea rows={3} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} maxLength={2000} />
            </Field>
            <Field label="Notes to client">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />
            </Field>
            <Field label="Terms">
              <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={2000} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>{isEdit ? `Draft ${invoiceNumber ?? ""}` : "Summary"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="num">{formatMoney(totals.subtotal.toString(), currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="num">− {formatMoney(totals.discount.toString(), currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sales tax</span>
            <span className="num">{formatMoney(totals.taxAmount.toString(), currency)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span className="num text-lg">{formatMoney(totals.total.toString(), currency)}</span>
          </div>
          <Button className="mt-3 w-full" disabled={!canSubmit} onClick={submit}>
            {pending ? "Saving…" : isEdit ? "Save draft" : "Create draft"}
          </Button>
          {isEdit ? (
            <Button
              variant="ghost"
              className="w-full"
              disabled={pending}
              onClick={() => router.push(`/app/${organizationSlug}/invoices/${invoiceId}`)}
            >
              Cancel
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Totals are recalculated on the server. Drafts stay editable until you mark them sent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
