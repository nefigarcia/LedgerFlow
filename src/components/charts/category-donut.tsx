"use client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { formatMoney } from "@/lib/money/money";
import { CHART_SERIES, CHART_TOOLTIP_STYLE } from "./chart-theme";

export function CategoryDonut({
  data,
  currency = "USD",
  dataKey = "amount",
  nameKey = "name",
}: {
  data: Array<Record<string, any>>;
  currency?: string;
  dataKey?: string;
  nameKey?: string;
}) {
  const total = data.reduce((s, d) => s + (Number(d[dataKey]) || 0), 0);
  return (
    <div className="relative h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            innerRadius={62}
            outerRadius={92}
            paddingAngle={1}
            stroke="hsl(var(--surface))"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_SERIES[i % CHART_SERIES.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => formatMoney(v, currency)}
            contentStyle={CHART_TOOLTIP_STYLE}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      {total > 0 ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8 text-center">
          <div className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">Total</div>
          <div className="num mt-0.5 text-lg font-semibold">{formatMoney(total, currency)}</div>
        </div>
      ) : null}
    </div>
  );
}
