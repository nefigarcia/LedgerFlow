import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function MembersSection({ memberships }: { memberships: any[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Members</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberships.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.user.name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.user.email}</TableCell>
                <TableCell><Badge variant={m.role === "OWNER" ? "default" : "muted"}>{m.role}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-4 text-xs text-muted-foreground">
          Invitation flow uses tokenized links. Email delivery is not wired in MVP — configure Resend or Postmark to send invites.
        </p>
      </CardContent>
    </Card>
  );
}
