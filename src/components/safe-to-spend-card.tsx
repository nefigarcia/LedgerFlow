import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { formatMoney } from "@/lib/money/money";

interface Props {
  currency: string;
  recordedCash: number;
  taxReserveRemaining: number;
  operatingReserve: number;
  available: number;
}

export function SafeToSpendCard({
  currency,
  recordedCash,
  taxReserveRemaining,
  operatingReserve,
  available,
}: Props) {
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Safe to distribute</CardTitle>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm whitespace-pre-line text-left leading-relaxed">
              {`Recorded cash
− Remaining tax reserve
− Operating reserve
= Available to distribute

This is a planning estimate. It reflects only transactions recorded in LedgerFlow.`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-1 text-sm">
          <Row label="Recorded cash" value={formatMoney(recordedCash, currency)} />
          <Row label="Tax reserve" value={`− ${formatMoney(taxReserveRemaining, currency)}`} muted />
          <Row label="Operating reserve" value={`− ${formatMoney(operatingReserve, currency)}`} muted />
        </dl>
        <div className="border-t pt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Available</div>
          <div className="num mt-1 text-3xl font-semibold tracking-tight text-success">
            {formatMoney(available, currency)}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Planning estimate based on recorded transactions. Not tax or accounting advice.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? "text-muted-foreground" : ""}>{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  );
}
