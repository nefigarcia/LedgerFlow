import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Money } from "@/components/ui/money";
import { formatMoney, formatPercent } from "@/lib/money/money";
import { initials } from "@/lib/utils";
import { TaxPaymentDialog } from "./tax-payment-dialog";
import type { OwnerTaxSnapshot } from "@/services/tax-planning";

const OWNER_COLORS = ["bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];

export function OwnerTaxCard({
  currency,
  organizationSlug,
  owner,
  colorIndex,
}: {
  currency: string;
  organizationSlug: string;
  owner: OwnerTaxSnapshot;
  colorIndex: number;
}) {
  const color = OWNER_COLORS[colorIndex % OWNER_COLORS.length];
  const fundingPct = owner.reserveTarget > 0
    ? Math.min(100, (owner.taxesPaid / owner.reserveTarget) * 100)
    : 0;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white ${color}`}>
            {initials(owner.name)}
          </div>
          <div>
            <div className="text-sm font-semibold">{owner.name}</div>
            <div className="text-2xs text-muted-foreground">
              {formatPercent(owner.ownershipPercentage, 1)} owner
              {owner.residenceState ? ` · ${owner.residenceState}` : ""}
            </div>
          </div>
        </div>
        <TaxPaymentDialog
          organizationSlug={organizationSlug}
          owners={[{ id: owner.ownerId, name: owner.name }]}
          currentYear={new Date().getFullYear()}
          defaultOwnerId={owner.ownerId}
          triggerLabel="Record payment"
          size="sm"
        />
      </div>

      <dl className="mt-4 space-y-1.5 text-sm">
        <Row label="Allocated profit YTD" value={formatMoney(owner.allocatedProfit, currency)} />
        <Row label="Planning reserve rate" value={formatPercent(owner.reserveRate, 1)} />
        <Row label="Recommended reserve" value={formatMoney(owner.reserveTarget, currency)} bold />
        <Row label="Payments made YTD" value={formatMoney(owner.taxesPaid, currency)} />
        <Row
          label="Remaining reserve"
          value={
            <Money
              value={owner.remainingReserve}
              currency={currency}
              tone={owner.remainingReserve > 0 ? "negative" : "positive"}
            />
          }
        />
        <Row label="Distributions YTD" value={formatMoney(owner.distributionsYtd, currency)} />
      </dl>

      <div className="mt-4">
        <Progress
          value={fundingPct}
          size="sm"
          indicatorClassName={fundingPct >= 100 ? "bg-success" : fundingPct >= 75 ? "bg-primary" : "bg-warning"}
        />
        <div className="mt-1 text-2xs text-muted-foreground">
          Payments funded {fundingPct.toFixed(0)}% of reserve target
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={bold ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      {typeof value === "string" ? <span className={`num ${bold ? "font-semibold" : "font-medium"}`}>{value}</span> : value}
    </div>
  );
}
