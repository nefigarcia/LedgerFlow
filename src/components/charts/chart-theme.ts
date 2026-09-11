/**
 * Shared chart theme values. Colors resolve from CSS variables at runtime
 * via getComputedStyle wrappers or hard-coded hsl(var(...)) strings.
 * Recharts renders inline SVG, so we prefer hsl(var(--chart-N)) strings.
 */
export const CHART_COLORS = {
  primary: "hsl(var(--chart-1))",
  emerald: "hsl(var(--chart-2))",
  amber: "hsl(var(--chart-3))",
  violet: "hsl(var(--chart-4))",
  cyan: "hsl(var(--chart-5))",
  slate: "hsl(var(--chart-6))",
};

export const CHART_SERIES = [
  CHART_COLORS.primary,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.violet,
  CHART_COLORS.cyan,
  CHART_COLORS.slate,
];

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  boxShadow: "var(--shadow-md)",
  color: "hsl(var(--popover-foreground))",
};

export const CHART_GRID_STROKE = "hsl(var(--border))";
export const CHART_AXIS_STROKE = "hsl(var(--muted-foreground))";
