"use client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { formatMoney } from "@/lib/money/money";

interface Row { label: string; revenue: number; expenses: number; profit: number; }

export function RevenueExpenseChart({ data, currency = "USD" }: { data: Row[]; currency?: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={70}
            tickFormatter={(v) => formatMoney(v, currency, { maximumFractionDigits: 0 })}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{ background: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: 8 }}
            formatter={(v: number) => formatMoney(v, currency)}
          />
          <Legend />
          <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
