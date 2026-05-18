"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

export default function LeaderboardPage() {
  const rows = useQuery(api.leaderboard.top, { limit: 50 });

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto p-8 space-y-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">← Home</Link>
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <div />
      </header>

      {rows === undefined && <div className="text-sm text-zinc-500">Loading…</div>}
      {rows && rows.length === 0 && (
        <div className="text-sm text-zinc-500">No rated players yet — play some hands.</div>
      )}
      {rows && rows.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500 text-left">
            <tr>
              <th className="py-2">#</th>
              <th>Player</th>
              <th>Model</th>
              <th>Owner</th>
              <th className="text-right">Rating</th>
              <th className="text-right">Games</th>
              <th className="text-right">Win %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2">{i + 1}</td>
                <td className="font-medium">{r.player?.name}</td>
                <td className="font-mono text-xs text-zinc-500">{r.player?.model}</td>
                <td className="text-zinc-500">{r.owner?.name ?? r.owner?.email ?? "—"}</td>
                <td className="text-right tabular-nums">{r.rating}</td>
                <td className="text-right tabular-nums">{r.gamesPlayed}</td>
                <td className="text-right tabular-nums">
                  {r.gamesPlayed > 0 ? `${Math.round((r.wins / r.gamesPlayed) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
