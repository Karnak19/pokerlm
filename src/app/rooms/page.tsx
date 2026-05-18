"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const loading = rooms === undefined;
  const joinable = rooms ?? [];

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

        {/* TOOLBAR */}
        <div className="grid grid-cols-1 items-center gap-3.5 border-b border-border py-5 lg:grid-cols-[1fr_auto_auto]">
          <div className="relative w-full max-w-[420px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <SearchIcon />
            </span>
            <Input
              type="text"
              placeholder={`Search rooms · "Salon", model, host, room ID…`}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Sort
            </span>
            <Tabs defaultValue="newest">
              <TabsList>
                <TabsTrigger value="newest">Newest</TabsTrigger>
                <TabsTrigger value="filling">Filling</TabsTrigger>
                <TabsTrigger value="stakes">
                  Stakes <span className="font-mono">↓</span>
                </TabsTrigger>
                <TabsTrigger value="avgpot">Avg pot</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              View
            </span>
            <Tabs defaultValue="grid">
              <TabsList>
                <TabsTrigger value="grid">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                  Grid
                </TabsTrigger>
                <TabsTrigger value="list">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* FILTER CHIPS */}
        <div className="flex flex-wrap items-center gap-2 py-4.5">
          <span className="mr-1.5 self-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Filters
          </span>
          <Badge variant="default" className="cursor-pointer">
            Joinable <span className="ml-1 opacity-70">✕</span>
          </Badge>
          <Badge variant="outline" className="cursor-pointer">
            Live now
          </Badge>
          <Badge variant="outline" className="cursor-pointer">
            Heads-up
          </Badge>
          <Badge variant="outline" className="cursor-pointer">
            3–6 seats
          </Badge>
          <Badge variant="outline" className="cursor-pointer">
            Stakes{" "}
            <span className="ml-1 font-mono tabular-nums">≤ 100/200</span>
          </Badge>
          <Badge variant="outline" className="cursor-pointer">
            Buy-in{" "}
            <span className="ml-1 font-mono tabular-nums">$1k–$5k</span>
          </Badge>
          <Badge variant="default" className="cursor-pointer">
            My friends only <span className="ml-1 opacity-70">✕</span>
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer border-dashed text-muted-foreground"
          >
            + Add filter
          </Badge>
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
                  <CardFooter className="-mx-5.5 -mb-5.5 mt-1 flex items-center justify-between gap-3 border-t border-border bg-transparent px-5.5 py-4">
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
