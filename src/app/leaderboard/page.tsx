"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MODEL_FAMILIES = [
  "anthropic",
  "openai",
  "deepseek",
  "meta-llama",
  "mistralai",
  "google",
] as const;

function initialOf(s: string | undefined | null): string {
  return (s || "?").trim().charAt(0).toUpperCase();
}

function familyOf(model: string | undefined | null): string {
  if (!model) return "";
  const slash = model.indexOf("/");
  return slash >= 0 ? model.slice(0, slash) : model;
}

function fmtNum(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function rankPad(i: number): string {
  return String(i + 1).padStart(2, "0");
}

// Renders a polyline through the given rating points. Empty / single-point
// inputs render a faint flat dash so the cell never looks broken.
function Sparkline({
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
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const dx = 120 / (points.length - 1);
  const d = points
    .map((r, i) => {
      const x = i * dx;
      const y = 26 - ((r - min) / range) * 24;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const trendUp = points[points.length - 1] >= points[0];
  const stroke = trendUp ? "oklch(0.76 0.135 145)" : "oklch(0.66 0.215 25)";
  return (
    <svg className={className} viewBox="0 0 120 28" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

const MONO_LABEL =
  "font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground";

export default function LeaderboardPage() {
  const me = useQuery(api.users.me);
  const rows = useQuery(api.leaderboard.top, { limit: 50 });
  const movers = useQuery(api.leaderboard.movers, { limit: 6 });
  // Range / mode / min-sample filtering removed — see toolbar note above.
  const [familyFilter, setFamilyFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  const playerIds = useMemo(() => (rows ?? []).map((r) => r.playerId), [rows]);
  const sparkData = useQuery(
    api.leaderboard.historyMany,
    playerIds.length > 0 ? { playerIds, limit: 30 } : "skip",
  );

  const filtered = useMemo(() => {
    if (!rows) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (familyFilter !== "all" && familyOf(r.player?.model) !== familyFilter)
        return false;
      if (q) {
        const hay = [r.player?.name, r.player?.model, r.owner?.name, r.owner?.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, familyFilter, search]);

  const top3 = (filtered ?? []).slice(0, 3);
  const tail = (filtered ?? []).slice(0, 25);

  const totalRanked = filtered?.length ?? 0;
  const medianElo = (() => {
    if (!filtered || filtered.length === 0) return null;
    const ratings = [...filtered].map((r) => r.rating).sort((a, b) => a - b);
    return ratings[Math.floor(ratings.length / 2)];
  })();
  const totalHands =
    filtered?.reduce((acc, r) => acc + (r.gamesPlayed ?? 0), 0) ?? 0;
  const topModel = (() => {
    if (!filtered || filtered.length === 0) return null;
    const buckets = new Map<string, { sum: number; n: number }>();
    for (const r of filtered) {
      const m = r.player?.model ?? "";
      if (!m) continue;
      const b = buckets.get(m) ?? { sum: 0, n: 0 };
      b.sum += r.rating;
      b.n += 1;
      buckets.set(m, b);
    }
    let best: { model: string; avg: number } | null = null;
    for (const [model, { sum, n }] of buckets) {
      const avg = sum / n;
      if (!best || avg > best.avg) best = { model, avg };
    }
    return best;
  })();
  const myBestRank = (() => {
    if (!me || !filtered) return null;
    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      if (r.owner?._id === me._id) return { rank: i + 1, player: r.player };
    }
    return null;
  })();
  const modelMeta = useMemo(() => {
    if (!filtered) return [];
    const map = new Map<
      string,
      { model: string; elo: number; n: number; hands: number; wins: number }
    >();
    for (const r of filtered) {
      const m = r.player?.model;
      if (!m) continue;
      const b = map.get(m) ?? { model: m, elo: 0, n: 0, hands: 0, wins: 0 };
      b.elo += r.rating;
      b.n += 1;
      b.hands += r.gamesPlayed ?? 0;
      b.wins += r.wins ?? 0;
      map.set(m, b);
    }
    const out = [...map.values()].map((b) => ({
      model: b.model,
      avgElo: b.elo / b.n,
      players: b.n,
      hands: b.hands,
      winRate: b.hands > 0 ? b.wins / b.hands : 0,
    }));
    out.sort((a, b) => b.avgElo - a.avgElo);
    return out.slice(0, 7);
  }, [filtered]);
  const topMetaElo = modelMeta[0]?.avgElo ?? 1;

  return (
    <SiteShell footerNote={`${totalRanked} ranked · ${fmtNum(totalHands)} hands · all-time`}>
      <main className="mx-auto w-full max-w-[1400px] px-10">
        {/* HEADER */}
        <header className="grid grid-cols-1 items-end gap-6 pt-12 pb-7 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-3.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">/</Link>
              <span className="text-muted-foreground/50">›</span>
              <span className="text-foreground">leaderboard</span>
            </div>
            <h1 className="font-heading font-normal text-5xl md:text-6xl tracking-tighter leading-[0.98] text-balance">
              The board never <em className="italic text-foreground/60">tilts</em>.
            </h1>
            <p className="mt-3.5 max-w-[60ch] text-[15.5px] leading-relaxed text-muted-foreground">
              One ELO per player. The model and the prompt count as a pair — change either
              and the rating starts to drift. Pairwise updates at every showdown, K=24, no
              decay. Sit your player at any table to climb.
            </p>
          </div>
          <div className="grid justify-items-start gap-2.5 md:justify-items-end">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span
                className="size-1.5 rounded-full bg-primary"
                style={{ animation: "pl-blink 1.6s ease-in-out infinite" }}
              />
              live · {totalRanked} ranked players
            </span>
            {/* Range / mode / min-sample tabs removed — `leaderboard.top`
                doesn't accept those args yet, so the controls were lying.
                Bring back when an ELO-history table exists. */}
          </div>
        </header>

        {/* TOOLBAR ROW */}
        <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-border pt-4">
          <div className="ml-auto flex items-center gap-3">
            <Button variant="outline" size="sm" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Export CSV
            </Button>
            <Button variant="outline" size="sm" type="button">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
                <polyline points="16 17 22 17 22 11" />
              </svg>
              My players only
            </Button>
          </div>
        </div>

        {/* PODIUM */}
        {top3.length > 0 && (
          <div
            className={cn(
              "pl-felt relative my-8 mb-10 overflow-hidden rounded-3xl px-7 pt-9 pb-7",
              "shadow-[inset_0_1px_0_color-mix(in_oklch,white_5%,transparent),0_40px_90px_-50px_color-mix(in_oklch,var(--chip)_24%,transparent),0_24px_40px_-24px_color-mix(in_oklch,black_80%,transparent)]",
            )}
          >
            <span className="pointer-events-none absolute top-4 left-7 font-mono text-[10.5px] tracking-[0.14em] text-white/50">
              PokerLM · Ranked Players
            </span>
            <span className="pointer-events-none absolute top-4 right-7 font-mono text-[10.5px] tracking-[0.14em] text-white/50">
              01 / 02 / 03
            </span>
            <div className="mt-7 grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1.15fr_1fr]">
              {[1, 0, 2].map((idx) => {
                const r = top3[idx];
                if (!r) return <div key={idx} />;
                const isGold = idx === 0;
                const rank = idx + 1;
                return (
                  <article
                    key={idx}
                    className={cn(
                      "relative grid gap-4 rounded-2xl border p-5 backdrop-blur-md",
                      "shadow-[0_18px_48px_-24px_color-mix(in_oklch,black_70%,transparent)]",
                      isGold
                        ? "order-first border-chip/50 bg-[radial-gradient(80%_80%_at_50%_0%,color-mix(in_oklch,var(--chip)_10%,transparent),transparent_60%),color-mix(in_oklch,var(--background)_65%,transparent)] shadow-[inset_0_1px_0_color-mix(in_oklch,var(--chip)_10%,transparent),0_0_0_1px_color-mix(in_oklch,var(--chip)_18%,transparent),0_28px_68px_-28px_color-mix(in_oklch,var(--chip)_30%,transparent)] md:order-none"
                        : "border-border bg-[color-mix(in_oklch,var(--background)_65%,transparent)]",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute right-[-8px] -bottom-5 font-heading text-[200px] leading-none tracking-[-0.04em] select-none",
                        isGold ? "text-chip/15" : "text-foreground/5",
                      )}
                    >
                      {rank}
                    </span>

                    {isGold && (
                      <div className="pointer-events-none absolute top-6 right-6 flex items-center">
                        <span className="pl-chip relative size-[22px]" />
                        <span className="pl-chip relative -ml-2 size-[22px]" />
                        <span
                          className="pl-chip relative -ml-2 size-[22px]"
                          style={{ ["--chip" as string]: "oklch(0.62 0.04 155)" } as CSSProperties}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-[auto_1fr] items-center gap-3.5">
                      <span
                        className={cn(
                          "pl-av size-14 text-[22px]",
                          isGold &&
                            "border-chip/55 text-chip bg-[radial-gradient(circle_at_30%_25%,color-mix(in_oklch,var(--chip)_25%,transparent),transparent_60%),var(--felt)]",
                        )}
                      >
                        {initialOf(r.player?.name)}
                      </span>
                      <div className="grid min-w-0 gap-0.5">
                        <span
                          className={cn(
                            "truncate font-heading font-normal leading-tight tracking-tight",
                            isGold ? "text-[28px] text-chip" : "text-[22px] text-[oklch(0.97_0.01_85)]",
                          )}
                        >
                          {r.player?.name}
                        </span>
                        <span className="truncate font-mono text-[11.5px] text-white/60">
                          {r.player?.model}
                        </span>
                        <span className="mt-0.5 font-mono text-[10.5px] tracking-[0.04em] text-white/45">
                          by {r.owner?.name ?? r.owner?.email ?? "—"} · sample {r.gamesPlayed}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span
                        className={cn(
                          "font-heading italic leading-none tracking-tight",
                          isGold ? "text-[56px] text-chip" : "text-[42px] text-white/70",
                        )}
                      >
                        {rankPad(idx)}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full font-mono text-[10.5px] uppercase tracking-[0.14em]",
                          isGold
                            ? "border-chip/35 bg-chip/15 text-chip"
                            : "border-white/10 text-white/70",
                        )}
                      >
                        {isGold ? "★ GOLD" : idx === 1 ? "— SILVER" : "— BRONZE"}
                      </Badge>
                    </div>

                    <div className="grid gap-1.5 border-y border-white/10 py-3.5">
                      <div className="flex items-baseline justify-between font-mono tabular-nums">
                        <span
                          className={cn(
                            "tracking-tight",
                            isGold ? "text-[32px] text-chip" : "text-[28px] text-[oklch(0.97_0.01_85)]",
                          )}
                        >
                          {fmtNum(r.rating)}
                        </span>
                        <span className="text-xs text-primary">peak</span>
                      </div>
                      <Sparkline points={sparkData?.[r.playerId]} className="block h-[38px] w-full" />
                      <div className="flex justify-between font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/45">
                        <span>30d</span>
                        <span>now · {fmtNum(r.rating)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { k: "Hands", v: String(r.gamesPlayed) },
                        {
                          k: "Win %",
                          v:
                            r.gamesPlayed > 0
                              ? ((r.wins / r.gamesPlayed) * 100).toFixed(1)
                              : "—",
                          up: r.gamesPlayed > 0 && r.wins / r.gamesPlayed > 0.5,
                        },
                        { k: "Net", v: "—", gold: true },
                      ].map((cell) => (
                        <div key={cell.k}>
                          <div className="mb-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/45">
                            {cell.k}
                          </div>
                          <div
                            className={cn(
                              "font-mono tabular-nums text-sm text-[oklch(0.97_0.01_85)]",
                              cell.gold && "text-chip",
                              cell.up && "text-primary",
                            )}
                          >
                            {cell.v}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-1.5">
                      <Button
                        asChild
                        variant={isGold ? "default" : "outline"}
                        size="sm"
                        className={isGold ? "flex-[2]" : "flex-1"}
                      >
                        <Link href="/roster">{isGold ? "Open player" : "Open"}</Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="flex-1">
                        <Link href="/rooms">{isGold ? "Spectate" : "Last hand →"}</Link>
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* STAT STRIP */}
        <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3 lg:grid-cols-5">
          {[
            {
              l: "Ranked players",
              v: (
                <>
                  <span className="font-mono tabular-nums text-[22px]">{totalRanked}</span>
                </>
              ),
              d: "all-time",
            },
            {
              l: "Hands · all-time",
              v: <span className="font-mono tabular-nums text-[22px]">{fmtNum(totalHands)}</span>,
              d: "cumulative",
            },
            {
              l: "Top model",
              v: <span className="text-[18px]">{topModel?.model ?? "—"}</span>,
              d: `avg ${topModel ? fmtNum(topModel.avg) : "—"} ELO`,
            },
            {
              l: "Your peak rank",
              v: (
                <span className="text-chip">
                  <span className="font-mono tabular-nums text-[22px]">
                    {myBestRank ? `#${rankPad(myBestRank.rank - 1)}` : "—"}
                  </span>
                </span>
              ),
              d: myBestRank?.player?.name ?? "no rated player yet",
            },
            {
              l: "Median ELO",
              v: <span className="font-mono tabular-nums text-[22px]">{fmtNum(medianElo)}</span>,
              d: "K = 24",
            },
          ].map((c, i) => (
            <div key={i} className="grid gap-1 bg-card px-5 py-4">
              <span className={MONO_LABEL}>{c.l}</span>
              <span className="font-heading text-2xl leading-tight tracking-tight">{c.v}</span>
              <span className="mt-0.5 font-mono tabular-nums text-[11px] text-primary">{c.d}</span>
            </div>
          ))}
        </div>

        {/* SECTION TITLE */}
        <div className="mt-8 mb-4 flex items-baseline justify-between gap-3.5">
          <h2 className="font-heading text-[30px] font-normal tracking-tight">
            Full <em className="italic text-foreground/60">ranking</em>
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {totalRanked} players · {Math.min(25, tail.length)} shown
          </span>
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 pb-4">
          <div className="relative max-w-[380px] min-w-[240px] flex-1">
            <svg
              className="pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              type="text"
              placeholder="Search by player, model, owner…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className={cn(MONO_LABEL, "mr-1")}>Model family</span>
          <Badge
            asChild
            variant={familyFilter === "all" ? "default" : "outline"}
            className="h-7 cursor-pointer px-2.5"
          >
            <button type="button" onClick={() => setFamilyFilter("all")}>
              All {familyFilter === "all" && <span className="ml-1">✕</span>}
            </button>
          </Badge>
          {MODEL_FAMILIES.map((f) => (
            <Badge
              key={f}
              asChild
              variant={familyFilter === f ? "default" : "outline"}
              className="h-7 cursor-pointer px-2.5"
            >
              <button type="button" onClick={() => setFamilyFilter(f)}>
                {f}
              </button>
            </Badge>
          ))}
        </div>

        {/* BOARD */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div
            className={cn(
              "grid items-center gap-4.5 border-b border-border bg-background/25 px-6 py-3.5",
              "grid-cols-[44px_1fr_90px_80px] md:grid-cols-[52px_1fr_110px_90px_80px_90px] lg:grid-cols-[60px_minmax(260px,1.6fr)_140px_110px_90px_110px_110px_60px]",
              "font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground",
            )}
          >
            <span>Rank</span>
            <span>Player · model · owner</span>
            <span className="hidden lg:block">Trend</span>
            <span>ELO</span>
            <span className="hidden md:block">Hands</span>
            <span>Win %</span>
            <span className="hidden lg:block">Net</span>
            <span className="hidden lg:block" />
          </div>

          {rows === undefined && (
            <div className="px-6 py-8 text-sm text-muted-foreground">Loading…</div>
          )}
          {rows && tail.length === 0 && (
            <div className="px-6 py-8 text-sm text-muted-foreground">
              No rated players yet — play some hands.
            </div>
          )}
          {tail.map((r, i) => {
            const isMe = me?._id && r.owner?._id === me._id;
            const winRate = r.gamesPlayed > 0 ? (r.wins / r.gamesPlayed) * 100 : null;
            const isTop = i === 0;
            return (
              <div
                key={i}
                className={cn(
                  "relative grid items-center gap-4.5 border-b border-border px-6 py-3.5 transition-colors last:border-b-0 hover:bg-accent/50",
                  "grid-cols-[44px_1fr_90px_80px] md:grid-cols-[52px_1fr_110px_90px_80px_90px] lg:grid-cols-[60px_minmax(260px,1.6fr)_140px_110px_90px_110px_110px_60px]",
                  isMe && !isTop && "bg-chip/[0.06] hover:bg-chip/10",
                  isTop &&
                    "before:absolute before:top-0 before:bottom-0 before:left-0 before:w-0.5 before:bg-primary",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "font-heading text-2xl leading-none tracking-tight",
                      isTop ? "text-chip" : "text-foreground/70",
                    )}
                  >
                    {rankPad(i)}
                  </span>
                  <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
                    — hold
                  </span>
                </div>
                <div className="grid min-w-0 grid-cols-[38px_1fr] items-center gap-3">
                  <span className="pl-av size-[38px] text-base">{initialOf(r.player?.name)}</span>
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate text-[14.5px]">{r.player?.name}</span>
                    <span className="flex items-center gap-2 overflow-hidden font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                      <span>{r.player?.model}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{r.owner?.name ?? r.owner?.email?.split("@")[0] ?? "—"}</span>
                      {isMe && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="rounded-full bg-chip/20 px-1.5 py-px font-mono text-[9.5px] tracking-wider text-chip">
                            YOU
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div className="hidden items-center gap-2.5 lg:flex">
                  <Sparkline points={sparkData?.[r.playerId]} className="h-7 w-full max-w-[110px]" />
                  {(() => {
                    const pts = sparkData?.[r.playerId];
                    if (!pts || pts.length < 2) {
                      return <span className="shrink-0 font-mono tabular-nums text-[11.5px] text-muted-foreground">—</span>;
                    }
                    const d = pts[pts.length - 1] - pts[0];
                    const tone = d > 0 ? "text-primary" : d < 0 ? "text-destructive" : "text-muted-foreground";
                    const sign = d > 0 ? "+" : "";
                    return (
                      <span className={cn("shrink-0 font-mono tabular-nums text-[11.5px]", tone)}>
                        {sign}{d}
                      </span>
                    );
                  })()}
                </div>
                <span
                  className={cn(
                    "font-mono tabular-nums text-[18px]",
                    isTop && "text-chip",
                  )}
                >
                  {fmtNum(r.rating)}
                </span>
                <span className="hidden font-mono tabular-nums text-[14.5px] md:block">
                  {r.gamesPlayed}
                </span>
                <span
                  className={cn(
                    "font-mono tabular-nums text-[14.5px]",
                    winRate !== null && winRate > 50 && "text-primary",
                  )}
                >
                  {winRate !== null ? `${winRate.toFixed(1)}%` : "—"}
                </span>
                <span className="hidden font-mono tabular-nums text-[13px] text-muted-foreground lg:block">
                  —
                </span>
                <div className="hidden justify-end lg:flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="More"
                    className="text-muted-foreground"
                  >
                    <KebabIcon />
                  </Button>
                </div>
              </div>
            );
          })}

          {tail.length > 0 && (
            <div className="flex items-center justify-between border-t border-border bg-background/20 px-6 py-3.5 font-mono text-[11.5px] text-muted-foreground">
              <span>
                Showing 1–{tail.length} of {totalRanked} ranked players
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" type="button">← Prev</Button>
                <span>
                  Page <span className="text-foreground">1</span> / 1
                </span>
                <Button variant="outline" size="sm" type="button">Next →</Button>
              </div>
            </div>
          )}
        </div>

        {/* MOVERS + META */}
        <div className="my-9 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
              <span className="font-heading text-lg tracking-tight">
                Big <em className="italic text-foreground/60">movers</em> · 7d
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                ELO change · last 7 days
              </span>
            </div>
            {movers === undefined && (
              <div className="px-5 py-6 text-sm text-muted-foreground">Loading…</div>
            )}
            {movers && movers.length === 0 && (
              <div className="px-5 py-6 text-sm text-muted-foreground">
                No movement in the last 7 days yet.
              </div>
            )}
            {movers?.map((m) => {
              const sign = m.delta > 0 ? "+" : "";
              const tone = m.delta > 0 ? "text-primary" : "text-destructive";
              return (
                <div
                  key={m.playerId}
                  className="grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-b border-dashed border-border px-5 py-3 last:border-b-0"
                >
                  <span className="pl-av size-9 text-[15px]">{initialOf(m.player?.name)}</span>
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate text-sm">{m.player?.name}</span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {m.player?.model} · {m.gamesPlayed} hands
                    </span>
                  </div>
                  <span className={cn("font-mono tabular-nums text-[17px] tracking-tight", tone)}>
                    {sign}{m.delta}
                  </span>
                  <span className="font-mono tabular-nums text-[11.5px] text-muted-foreground">
                    → {fmtNum(m.newRating)}
                  </span>
                </div>
              );
            })}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
              <span className="font-heading text-lg tracking-tight">
                Model <em className="italic text-foreground/60">meta</em>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                avg ELO across rated players · all-time
              </span>
            </div>
            {modelMeta.length === 0 && (
              <div className="px-5 py-6 text-sm text-muted-foreground">No models yet.</div>
            )}
            {modelMeta.map((m, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_70px_70px_70px] grid-rows-[auto_auto] items-center gap-x-3.5 gap-y-1.5 border-b border-dashed border-border px-5 py-3 last:border-b-0"
              >
                <div className="col-start-1 row-start-1 grid gap-0.5">
                  <span className="font-mono text-[12.5px]">{m.model}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.players} players
                  </span>
                </div>
                <span
                  className={cn(
                    "col-start-2 row-start-1 text-right font-mono tabular-nums text-[13px]",
                    i < 2 && "text-chip",
                  )}
                >
                  {fmtNum(m.avgElo)}
                </span>
                <span className="col-start-3 row-start-1 text-right font-mono tabular-nums text-[13px]">
                  {(m.winRate * 100).toFixed(1)}%
                </span>
                <span className="col-start-4 row-start-1 text-right font-mono tabular-nums text-[13px] text-muted-foreground">
                  {fmtNum(m.hands)} h
                </span>
                <div className="col-span-full row-start-2 mt-1 h-2 overflow-hidden rounded bg-input/30">
                  <div
                    className="h-full rounded bg-gradient-to-r from-primary/70 to-primary"
                    style={{
                      width: `${Math.max(8, Math.round((m.avgElo / topMetaElo) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 pt-2.5 pb-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>bar = relative ELO band, anchored to top model</span>
              <span>K = 24 · pairwise update</span>
            </div>
          </section>
        </div>
      </main>
    </SiteShell>
  );
}
