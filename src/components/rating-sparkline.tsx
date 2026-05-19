"use client";

import { Line, LineChart, YAxis } from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";

const CONFIG = {
  rating: { label: "Rating", color: "var(--color-primary)" },
} satisfies ChartConfig;

/**
 * Tiny inline sparkline for ELO history. Pass an array of ratings; we render a
 * single Recharts line with auto-fit Y-axis, no axes, no grid, no tooltip.
 * Used in leaderboard rows and the podium cards.
 */
export function RatingSparkline({
  points,
  className,
}: {
  points: number[] | undefined;
  className?: string;
}) {
  if (!points || points.length < 2) {
    return (
      <svg className={className} viewBox="0 0 120 28" preserveAspectRatio="none">
        <line
          x1="0"
          y1="14"
          x2="120"
          y2="14"
          stroke="oklch(0.66 0.018 85)"
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.4"
        />
      </svg>
    );
  }
  const data = points.map((rating, i) => ({ i, rating }));
  const trendUp = points[points.length - 1] >= points[0];
  const color = trendUp ? "oklch(0.76 0.135 145)" : "oklch(0.66 0.215 25)";
  return (
    <ChartContainer config={CONFIG} className={className}>
      <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line
          type="monotone"
          dataKey="rating"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
          strokeLinecap="round"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
