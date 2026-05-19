"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const CONFIG = {
  rating: { label: "Rating", color: "var(--color-primary)" },
} satisfies ChartConfig;

type Point = { rating: number; at: number };

/**
 * Per-player rating history chart. Bigger than RatingSparkline — has axes,
 * a faint grid, an area fill, and a tooltip on hover. Used in the /roster
 * editor side panel.
 */
export function RatingChart({
  points,
  className,
}: {
  points: Point[] | undefined;
  className?: string;
}) {
  if (!points || points.length < 2) {
    return (
      <div
        className={
          "grid place-items-center rounded-md border border-dashed border-border bg-background/40 text-[11px] text-muted-foreground " +
          (className ?? "")
        }
      >
        No rated hands yet.
      </div>
    );
  }
  const data = points.map((p) => ({
    t: p.at,
    rating: p.rating,
  }));
  return (
    <ChartContainer config={CONFIG} className={className}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rating-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={(v: number) =>
            new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          }
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
          minTickGap={32}
        />
        <YAxis
          domain={["dataMin - 20", "dataMax + 20"]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
          width={32}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(v) => new Date(v as number).toLocaleString()} />}
        />
        <Area
          type="monotone"
          dataKey="rating"
          stroke="var(--color-primary)"
          strokeWidth={1.5}
          fill="url(#rating-fill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
