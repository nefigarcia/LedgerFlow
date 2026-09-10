"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { upsertOwnerAction } from "@/features/settings/actions";
import { Plus, Save } from "lucide-react";

export function OwnersSection({
  organizationSlug,
  owners,
}: {
  organizationSlug: string;
  owners: any[];
}) {
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Owners</CardTitle>
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus className="h-4 w-4" /> {creating ? "Cancel" : "Add owner"}
          </Button>
        </CardHeader>
        <CardContent>
          {creating && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                start(async () => {
                  const res = await upsertOwnerAction(organizationSlug, null, fd);
                  if (!res.success) { toast.error(res.error.message); return; }
                  toast.success("Owner added");
                  setCreating(false);
                  router.refresh();
                });
              }}
              className="mb-4 grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-[1.5fr_1.5fr_1fr_1fr_auto]"
            >
              <Field label="Name" required><Input name="name" required /></Field>
              <Field label="Email"><Input name="email" type="email" /></Field>
              <Field label="Ownership %"><Input name="ownershipPercentage" type="number" step="0.01" defaultValue="0" required /></Field>
              <Field label="Distribution %"><Input name="distributionPercentage" type="number" step="0.01" defaultValue="0" required /></Field>
              <div className="flex items-end"><Button type="submit" disabled={pending}><Save className="h-4 w-4" /> Save</Button></div>
            </form>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Ownership</TableHead>
                <TableHead>Distribution</TableHead>
                <TableHead>Tax reserve override</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.name}</TableCell>
                  <TableCell>{o.ownershipPercentage.toString()}%</TableCell>
                  <TableCell>{o.distributionPercentage.toString()}%</TableCell>
                  <TableCell>{o.taxReserveOverride ? o.taxReserveOverride.toString() + "%" : "—"}</TableCell>
                  <TableCell>{o.active ? "Active" : "Inactive"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
