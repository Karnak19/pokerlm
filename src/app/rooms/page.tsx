"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function RoomsPage() {
  const rooms = useQuery(api.rooms.listOpen);
  const myPlayers = useQuery(api.players.listMine);
  const [search, setSearch] = useState("");

  // Highest bankroll across all alive players — used to gate the Sit
  // button on each room card. If none of the user's players can afford a
  // table's buy-in, the button is disabled.
  const maxAliveBankroll = useMemo(() => {
    if (!myPlayers) return null;
    const alive = myPlayers.filter((p: Doc<"players">) => p.status !== "retired");
    if (alive.length === 0) return 0;
    return Math.max(...alive.map((p) => p.bankroll ?? 5000));
  }, [myPlayers]);

  const loading = rooms === undefined;
  const joinable = useMemo(() => {
    const all = rooms ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      r.name.toLowerCase().includes(q) || r._id.toLowerCase().includes(q),
    );
  }, [rooms, search]);

  return (
    <SiteShell footerNote={`${joinable.length} open · ${rooms === undefined ? "…" : rooms.length} total`}>
      <main className="mx-auto w-full max-w-[1400px] px-10">
        {/* PAGE HEAD */}
        <header className="grid grid-cols-[1fr_auto] items-end gap-6 py-12">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                /
              </Link>
              <span className="text-muted-foreground/50">›</span>
              <span className="text-foreground">rooms</span>
            </div>
            <h1 className="font-heading font-normal text-5xl tracking-tighter leading-[0.98]">
              Pull up a <em className="italic text-primary">chair</em>.
            </h1>
            <p className="mt-3.5 max-w-[60ch] text-[15.5px] leading-relaxed text-muted-foreground">
              Open rooms list themselves; live tables are spectate-only. Stakes
              are in chips, not currency — buy-in equals the starting stack.
              Models decide in parallel, so the table moves at the speed of its
              slowest seat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="lg" asChild>
              <Link href="/rooms/new">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                New room
              </Link>
            </Button>
          </div>
        </header>

        {/* TOOLBAR — sort/view/filter chips removed; they were inert.
            Reintroduce when there's actual sorting/filtering logic to wire. */}
        <div className="border-b border-border py-5">
          <div className="relative w-full max-w-[420px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <SearchIcon />
            </span>
            <Input
              type="text"
              placeholder="Search by name or room id…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* SECTION · JOINABLE */}
        <div className="mt-9 mb-4 flex items-baseline justify-between gap-3.5">
          <h2 className="font-heading text-[28px] font-normal tracking-tight">
            Joinable <em className="italic text-primary">now</em>
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {loading
              ? "—"
              : `${joinable.length} room${joinable.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {loading ? (
          <div className="py-10 text-muted-foreground">Loading…</div>
        ) : joinable.length === 0 ? (
          <p className="font-heading italic text-muted-foreground py-10">
            No open rooms.
          </p>
        ) : (
          <div className="grid gap-4.5 grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
            {joinable.map((r) => {
              const full = r.seatsTaken >= r.maxSeats;
              const freeSeats = Math.max(0, r.maxSeats - r.seatsTaken);
              const idShort = r._id.slice(-4);
              const initial = (r.name || "?").trim().charAt(0).toUpperCase();
              const filledAvs = Array.from({ length: r.seatsTaken });
              return (
                <Card
                  key={r._id}
                  className={`gap-4 rounded-2xl p-5.5 transition-colors hover:border-primary/35 ${
                    full ? "opacity-75" : ""
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-3 px-0">
                    <div>
                      <h3 className="font-heading text-2xl font-normal leading-tight tracking-tight">
                        {r.name}
                      </h3>
                      <div className="mt-1 font-mono text-[10.5px] text-muted-foreground">
                        room · <span className="tabular-nums">{idShort}</span>{" "}
                        · seats{" "}
                        <span className="tabular-nums">
                          {r.seatsTaken}/{r.maxSeats}
                        </span>
                      </div>
                    </div>
                    {full ? (
                      <Badge variant="outline" className="gap-1.5">
                        <span className="size-1.5 rounded-full bg-muted-foreground" />
                        Full · waiting
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1.5">
                        <span className="size-1.5 rounded-full bg-primary-foreground/80" />
                        Open
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="px-0">
                    <div className="grid grid-cols-3 gap-3.5 border-y border-dashed border-border py-3.5">
                      <div>
                        <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                          Stakes
                        </div>
                        <div className="font-mono tabular-nums text-sm">
                          {r.smallBlind} / {r.bigBlind}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                          Buy-in
                        </div>
                        <div className="font-mono tabular-nums text-sm">
                          {r.startingStack.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                          Avg pot
                        </div>
                        <div className="font-mono tabular-nums text-sm">
                          —
                        </div>
                      </div>
                    </div>
                    <div className="mt-4.5 grid grid-cols-[1fr_auto] items-center gap-3">
                      <div className="flex items-center -space-x-2">
                        {filledAvs.map((_, i) => (
                          <Avatar
                            key={i}
                            size="sm"
                            className="pl-av size-[30px] text-[13px]"
                          >
                            <AvatarFallback className="bg-transparent text-inherit">
                              {initial}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {freeSeats > 0 && (
                          <Avatar
                            size="sm"
                            className="size-[30px] border border-dashed border-border bg-input/35 text-muted-foreground"
                          >
                            <AvatarFallback className="bg-transparent font-mono text-[11px] text-muted-foreground">
                              +{freeSeats}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <div className="text-right font-mono text-xs text-muted-foreground">
                        <span className="block text-base text-foreground tabular-nums">
                          {r.seatsTaken} / {r.maxSeats}
                        </span>
                        {full
                          ? "all seats taken"
                          : `${freeSeats} seat${freeSeats === 1 ? "" : "s"} free`}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="-mx-5.5 mt-1 flex items-center justify-between gap-3 border-t border-border bg-transparent px-5.5 py-4">
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full border border-border bg-input/20 px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                        mixed models
                      </span>
                    </div>
                    {full ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="cursor-not-allowed opacity-60"
                      >
                        Waitlist
                      </Button>
                    ) : maxAliveBankroll !== null && maxAliveBankroll < r.startingStack ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="cursor-not-allowed opacity-60"
                        title={`Needs $${r.startingStack} buy-in; your richest player has $${maxAliveBankroll}`}
                      >
                        Need ${r.startingStack}
                      </Button>
                    ) : (
                      <Button size="sm" asChild>
                        <Link href={`/rooms/${r._id}`}>Sit</Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

      </main>
    </SiteShell>
  );
}
