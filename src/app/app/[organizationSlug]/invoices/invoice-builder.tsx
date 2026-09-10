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
import { Plus, Trash2 } from "lucide-react";
import { createInvoiceAction } from "@/features/invoices/actions";
import { formatMoney } from "@/lib/money/money";
import { computeInvoiceTotals } from "@/services/invoice-calc";

interface Client { id: string; companyName: string; }
interface Project { id: string; name: string; hourlyRate: any; clientId: string; }
interface Item { description: string; quantity: string; unit: string; rate: string; projectId?: string | null }

const UNITS = ["HOURS", "ITEMS", "DAYS", "FLAT", "OTHER"];

export function InvoiceBuilder({
  organizationSlug,
  currency,
  clients,
  projects,
  defaults,
}: {
  organizationSlug: string;
  currency: string;
  clients: Client[];
  projects: Project[];
  defaults: { issueDate: string; dueDate: string; preselectedClientId: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState<string>(defaults.preselectedClientId ?? clients[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(defaults.issueDate);
  const [dueDate, setDueDate] = useState(defaults.dueDate);
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [items, setItems] = useState<Item[]>([
    { description: "", quantity: "1", unit: "HOURS", rate: "0", projectId: null },
  ]);

  const clientProjects = projects.filter((p) => p.clientId === clientId);

  const totals = useMemo(() => {
    const priced = items.map((i) => ({ amount: Number(i.quantity || 0) * Number(i.rate || 0) }));
    return computeInvoiceTotals(priced, Number(discount || 0), Number(taxRate || 0));
  }, [items, discount, taxRate]);

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: "1", unit: "HOURS", rate: "0", projectId }]);
  }
  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Client" required>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Project (optional)">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Issue date" required>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </Field>
            <Field label="Due date" required>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </Field>
            <Field label="PO / reference">
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </Field>
            <Field label="Tax rate %">
              <Input type="number" step="0.01" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </Field>
            <Field label="Discount">
              <Input type="number" step="0.01" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">Line items</div>
              <Button size="sm" variant="outline" onClick={addItem} type="button">
                <Plus className="h-4 w-4" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-[2fr_0.7fr_0.9fr_1fr_1fr_auto]">
                  <Input
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Qty"
                    value={it.quantity}
                    onChange={(e) => updateItem(i, { quantity: e.target.value })}
                  />
                  <Select value={it.unit} onValueChange={(v) => updateItem(i, { unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="Rate"
                    value={it.rate}
                    onChange={(e) => updateItem(i, { rate: e.target.value })}
                  />
                  <div className="flex items-center justify-end text-sm text-muted-foreground num">
                    {formatMoney(Number(it.quantity || 0) * Number(it.rate || 0), currency)}
                  </div>
                  <Button variant="ghost" size="icon" type="button" onClick={() => removeItem(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Notes to client">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Terms">
              <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit sticky top-16">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
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
            <span className="text-muted-foreground">Tax</span>
            <span className="num">{formatMoney(totals.taxAmount.toString(), currency)}</span>
          </div>
          <div className="border-t pt-2 flex items-center justify-between font-semibold">
            <span>Total</span>
            <span className="num text-lg">{formatMoney(totals.total.toString(), currency)}</span>
          </div>
          <Button
            className="mt-3 w-full"
            disabled={pending || !clientId || items.some((i) => !i.description.trim())}
            onClick={() => {
              start(async () => {
                const res = await createInvoiceAction(organizationSlug, {
                  clientId,
                  projectId: projectId || null,
                  issueDate,
                  dueDate,
                  poNumber: poNumber || null,
                  notes: notes || null,
                  terms: terms || null,
                  discount: Number(discount || 0),
                  taxRate: Number(taxRate || 0),
                  items: items.map((i) => ({
                    description: i.description,
                    quantity: Number(i.quantity || 0),
                    unit: i.unit,
                    rate: Number(i.rate || 0),
                    projectId: i.projectId ?? null,
                  })),
                });
                if (!res.success) { toast.error(res.error.message); return; }
                toast.success(`Invoice ${res.data.invoiceNumber} created`);
                router.push(`/app/${organizationSlug}/invoices/${res.data.id}`);
                router.refresh();
              });
            }}
          >
            {pending ? "Creating…" : "Create draft"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Totals are calculated server-side using safe decimal math.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
