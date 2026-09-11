"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatMoney } from "@/lib/money/money";
import { CHART_COLORS, CHART_GRID_STROKE, CHART_AXIS_STROKE, CHART_TOOLTIP_STYLE } from "./chart-theme";

interface Row {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

/**
 * Refined revenue vs expenses chart.
 * Uses primary blue for revenue, restrained slate for expenses,
 * a custom tooltip with clear currency formatting, and shows profit
 * only in the tooltip so the visual isn't triple-stacked.
 */
export function RevenueExpenseChart({ data, currency = "USD" }: { data: Row[]; currency?: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke={CHART_AXIS_STROKE} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={64}
            stroke={CHART_AXIS_STROKE}
            tickFormatter={(v) => formatMoney(v, currency, { maximumFractionDigits: 0 })}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, fontSize: 12 }}
            formatter={(value: number, name: string) => [formatMoney(value, currency), name]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expenses" name="Expenses" fill={CHART_COLORS.slate} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
