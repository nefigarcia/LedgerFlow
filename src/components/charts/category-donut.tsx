"use client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { formatMoney } from "@/lib/money/money";

const COLORS = [
  "hsl(222,47%,20%)",
  "hsl(152,55%,38%)",
  "hsl(38,92%,50%)",
  "hsl(210,60%,50%)",
  "hsl(0,72%,55%)",
  "hsl(275,50%,50%)",
  "hsl(190,60%,45%)",
  "hsl(35,60%,45%)",
];

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
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={50} outerRadius={90} strokeWidth={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => formatMoney(v, currency)}
            contentStyle={{ background: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
          />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
