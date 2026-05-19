import { cacheLife } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import LeaderboardView from "./leaderboard-view";

// Heavy snapshot data is cached server-side and refreshed every few minutes.
// Tradeoff: ELO changes don't appear live, but the page ships rendered HTML
// and skips per-visitor Convex subscriptions for the ranking, movers, and
// sparkline queries. The "Your peak rank" stat stays a tiny client query so
// it remains accurate per viewer.
async function getLeaderboardData() {
  "use cache";
  cacheLife("minutes");
  const rows = await fetchQuery(api.leaderboard.top, { limit: 50 });
  const playerIds = rows.map((r) => r.playerId);
  const [movers, sparkData] = await Promise.all([
    fetchQuery(api.leaderboard.movers, { limit: 6 }),
    playerIds.length > 0
      ? fetchQuery(api.leaderboard.historyMany, { playerIds, limit: 30 })
      : Promise.resolve({}),
  ]);
  return { rows, movers, sparkData };
}

export default async function LeaderboardPage() {
  const { rows, movers, sparkData } = await getLeaderboardData();
  return (
    <LeaderboardView
      initialRows={rows}
      initialMovers={movers}
      initialSparkData={sparkData}
    />
  );
}
