"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SUIT_GLYPH: Record<string, string> = { h: "♥", d: "♦", s: "♠", c: "♣" };
const RED_SUITS = new Set(["h", "d"]);

function parseCard(c: string): { rank: string; suit: string; glyph: string; red: boolean } | null {
  if (!c || c.length < 2) return null;
  const rank = c.slice(0, c.length - 1).toUpperCase();
  const suit = c.slice(-1).toLowerCase();
  const glyph = SUIT_GLYPH[suit];
  if (!glyph) return null;
  return { rank, suit, glyph, red: RED_SUITS.has(suit) };
}

// Card sizes: lg = community / hero, sm = hole cards next to seats.
const CARD_SIZE: Record<"sm" | "lg", string> = {
  sm: "w-[30px]",
  lg: "w-[58px]",
};

function CardFace({ card, size = "lg" }: { card: string; size?: "sm" | "lg" }) {
  const p = parseCard(card);
  if (!p) return <CardBack size={size} />;
  return (
    <div
      data-suit={p.red ? "red" : "black"}
      className={cn(
        "pl-card relative grid rounded-[6px] font-heading",
        CARD_SIZE[size],
        size === "sm" ? "text-[11px] leading-none" : "text-[13px] leading-none",
      )}
    >
      <div className={cn("absolute left-1.5 top-1 flex items-center gap-0.5", size === "sm" && "left-1 top-0.5")}>
        <span className="font-medium">{p.rank}</span>
        <span>{p.glyph}</span>
      </div>
      <div
        className={cn(
          "grid h-full place-items-center",
          size === "sm" ? "text-[16px]" : "text-[28px]",
        )}
      >
        {p.glyph}
      </div>
      <div
        className={cn(
          "absolute bottom-1 right-1.5 flex items-center gap-0.5 rotate-180",
          size === "sm" && "bottom-0.5 right-1",
        )}
      >
        <span className="font-medium">{p.rank}</span>
        <span>{p.glyph}</span>
      </div>
    </div>
  );
}

function CardBack({ size = "lg" }: { size?: "sm" | "lg" }) {
  return <div className={cn("pl-card-back rounded-[6px]", CARD_SIZE[size])} />;
}

// 6-seat oval positions, ordered clockwise from the top. Seat index N always
// renders at SEAT_STYLE[N] regardless of viewer, so the layout is identical
// for every device watching the same hand.
const SEAT_STYLE: CSSProperties[] = [
  // 0 — top
  { top: -22, left: "50%", transform: "translateX(-50%)" },
  // 1 — top right
  { top: "28%", right: -30, transform: "translateY(-50%)" },
  // 2 — bottom right
  { bottom: "28%", right: -30, transform: "translateY(50%)" },
  // 3 — bottom
  { bottom: -22, left: "50%", transform: "translateX(-50%)" },
  // 4 — bottom left
  { bottom: "28%", left: -30, transform: "translateY(50%)" },
  // 5 — top left
  { top: "28%", left: -30, transform: "translateY(-50%)" },
];

const HOLE_STYLE: CSSProperties[] = [
  { bottom: -22, left: "50%", transform: "translateX(-50%)" },
  { right: "100%", top: "50%", marginRight: 8, transform: "translateY(-50%)" },
  { right: "100%", top: "50%", marginRight: 8, transform: "translateY(-50%)" },
  { top: -22, left: "50%", transform: "translateX(-50%)" },
  { left: "100%", top: "50%", marginLeft: 8, transform: "translateY(-50%)" },
  { left: "100%", top: "50%", marginLeft: 8, transform: "translateY(-50%)" },
];

const BET_STYLE: CSSProperties[] = [
  { top: "100%", left: "50%", marginTop: 32, transform: "translateX(-50%)" },
  { right: "100%", top: "50%", marginRight: 58, transform: "translateY(-50%)" },
  { right: "100%", top: "50%", marginRight: 58, transform: "translateY(-50%)" },
  { bottom: "100%", left: "50%", marginBottom: 32, transform: "translateX(-50%)" },
  { left: "100%", top: "50%", marginLeft: 58, transform: "translateY(-50%)" },
  { left: "100%", top: "50%", marginLeft: 58, transform: "translateY(-50%)" },
];

const DEALER_STYLE: CSSProperties[] = [
  { top: 78, left: "50%", transform: "translate(-50%, -50%)" },
  { top: "30%", right: 230, transform: "translateY(-50%)" },
  { bottom: "30%", right: 230, transform: "translateY(50%)" },
  { bottom: 78, left: "50%", transform: "translate(-50%, 50%)" },
  { bottom: "30%", left: 230, transform: "translateY(50%)" },
  { top: "30%", left: 230, transform: "translateY(-50%)" },
];

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id as Id<"rooms">;

  const room = useQuery(api.rooms.get, { roomId });
  const game = useQuery(api.games.current, { roomId });
  const me = useQuery(api.users.me);
  const myPlayers = useQuery(api.players.listMine);

  const sit = useMutation(api.rooms.sit);
  const leave = useMutation(api.rooms.leave);
  const start = useMutation(api.rooms.start);
  const decide = useAction(api.openrouter.decide);

  const [selectedPlayer, setSelectedPlayer] = useState<Id<"players"> | "">("");
  // Read once at mount; the OpenRouter-key chip in the nav owns writes to sessionStorage.
  const apiKey = useMemo(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("pokerlm.openrouter.key") ?? "";
  }, []);
  const deciding = useRef<string | null>(null);

  const mySeat = me && room ? room.seats.find((s) => s.userId === me._id) : undefined;
  const isCreator = !!me && !!room && me._id === room.createdBy;

  const state = game?.state;
  const toActSeatIndex = state?.toAct ?? null;
  const toActSeat = toActSeatIndex !== null && toActSeatIndex !== undefined && room
    ? room.seats.find((s) => s.seatIndex === toActSeatIndex)
    : undefined;

  // Every seat is AI-driven; whichever browser owns the to-act seat fires the LLM.
  useEffect(() => {
    if (!apiKey || !game || game.status !== "in_progress" || !me) return;
    if (toActSeat?.userId !== me._id) return;
    const tag = `${game.gameId}:${toActSeatIndex}:${game.recentActions.length}`;
    if (deciding.current === tag) return;
    deciding.current = tag;
    void decide({ gameId: game.gameId, apiKey })
      .catch((e) => { console.error("decide failed", e); })
      .finally(() => {
        setTimeout(() => { if (deciding.current === tag) deciding.current = null; }, 1000);
      });
  }, [apiKey, game, me, toActSeat, toActSeatIndex, decide]);

  if (room === undefined) {
    return (
      <SiteShell>
        <main className="mx-auto w-full max-w-[1400px] px-10 py-10 text-muted-foreground">
          Loading…
        </main>
      </SiteShell>
    );
  }
  if (room === null) {
    return (
      <SiteShell>
        <main className="mx-auto w-full max-w-[1400px] px-10 py-10 text-muted-foreground">
          Room not found.
        </main>
      </SiteShell>
    );
  }

  const community: string[] = state?.community ?? [];
  const pot = state?.pot ?? 0;
  const street = state?.street ?? "waiting";
  const dealerIndex = state?.dealerIndex;
  const recent = game?.recentActions ?? [];

  const handNumber = game?.handNumber;
  const roomCode = room._id.slice(-4);
  const blinds = `${room.smallBlind} / ${room.bigBlind}`;

  // Seat positions are fixed: seat index 0 → position 0, 1 → 1, etc.
  // Same layout for everyone. (Previously the viewer's own seat was rotated
  // to the bottom — that's nice for solo play but inconsistent across
  // devices and confusing when multiple people watch the same hand.)
  const rotate = (i: number) => i;

  return (
    <SiteShell footerNote={`${room.name} · hand ${handNumber ? `#${handNumber}` : "—"} · ${street}`}>
      <main className="mx-auto w-full max-w-[1400px] px-10">
        {/* Room header */}
        <header className="grid grid-cols-[1fr_auto] items-center gap-6 border-b border-border py-6">
          <div>
            <div className="mb-2.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">/</Link>
              <span className="text-muted-foreground/50">›</span>
              <Link href="/rooms" className="hover:text-foreground">rooms</Link>
              <span className="text-muted-foreground/50">›</span>
              <span className="font-mono text-foreground/80">{roomCode}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-4">
              <h1 className="font-heading text-[38px] font-normal leading-none tracking-tight">
                {room.name}
              </h1>
              {game?.status === "in_progress" ? (
                <Badge variant="default" className="gap-1.5">
                  <span className="size-1.5 rounded-full bg-current animate-pulse" />
                  Live
                </Badge>
              ) : room.status === "waiting" ? (
                <Badge variant="outline">Waiting</Badge>
              ) : (
                <Badge variant="secondary">{room.status}</Badge>
              )}
              {handNumber && (
                <Badge variant="outline" className="font-mono tabular-nums">
                  #{String(handNumber).padStart(4, "0")}
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-xs text-muted-foreground">
              <span>{room.seats.length} / {room.maxSeats} seats</span>
              <span className="text-muted-foreground/40">·</span>
              <span>blinds {blinds}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>buy-in ${room.startingStack}</span>
              {isCreator && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>hosted by you</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {room.status === "waiting" && isCreator && room.seats.length >= 2 && (
              <Button onClick={() => start({ roomId })}>Start game</Button>
            )}
            {game?.status === "complete" && (
              <span className="inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
                dealing next hand…
              </span>
            )}
            {mySeat && (
              <Button
                variant="destructive"
                onClick={() => {
                  const live = room.status === "playing" && game?.status === "in_progress";
                  if (live && !confirm("Leaving mid-hand will fold your seat. Continue?")) return;
                  void leave({ roomId });
                }}
              >
                Leave table
              </Button>
            )}
          </div>
        </header>

        {/* Head stats strip */}
        <Card className="my-5 flex flex-row flex-wrap items-center gap-5 py-4 px-5">
          <div className="grid gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Hand</span>
            <span className="font-mono tabular-nums text-base">
              {handNumber ? `#${String(handNumber).padStart(4, "0")}` : "—"}
            </span>
          </div>
          <Separator orientation="vertical" className="!h-7" />
          <div className="grid gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Street</span>
            <span className="font-mono tabular-nums text-base capitalize">
              {street}{" "}
              <em className="font-heading not-italic italic text-sm text-muted-foreground">
                · {community.length} cards
              </em>
            </span>
          </div>
          <Separator orientation="vertical" className="!h-7" />
          <div className="grid gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Pot</span>
            <span className="font-mono tabular-nums text-base text-chip">${pot}</span>
          </div>
          <Separator orientation="vertical" className="!h-7" />
          <div className="grid gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">To act</span>
            <span className="font-mono tabular-nums text-base">{toActSeat?.player?.name ?? "—"}</span>
          </div>
          <Separator orientation="vertical" className="!h-7" />
          <div className="grid gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Current bet</span>
            <span className="font-mono tabular-nums text-base">${state?.currentBet ?? 0}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-primary">
              <span className="size-[5px] rounded-full bg-current" />
              {street}{toActSeat ? " · acting" : ""}
            </span>
          </div>
        </Card>

        <Show when="signed-out">
          <Card className="p-8 text-center">
            <p className="mb-3">Sign in to take a seat.</p>
            <SignInButton mode="modal">
              <Button type="button">Sign in</Button>
            </SignInButton>
          </Card>
        </Show>

        <Show when="signed-in">
          {/* Stage: felt + thinking pane */}
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* Felt */}
            <div className="pl-felt relative overflow-hidden rounded-[20px] px-7 pt-7 pb-6">
              <div className="mb-3.5 flex items-center justify-between font-mono text-[11px] text-white/60">
                <div className="flex items-center gap-3">
                  <span>HAND · {handNumber ? String(handNumber).padStart(4, "0") : "—"}</span>
                  <span className="text-white/25">·</span>
                  <span>blinds {blinds}</span>
                  {dealerIndex !== undefined && dealerIndex !== null && (
                    <>
                      <span className="text-white/25">·</span>
                      <span>button @ seat {dealerIndex + 1}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span>{room.status}</span>
                </div>
              </div>

              {/* Table oval */}
              <div
                className="relative h-[540px] rounded-[280px] border border-primary/30"
                style={{
                  background:
                    "radial-gradient(60% 60% at 50% 45%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 70%), color-mix(in oklch, var(--felt) 92%, black)",
                  boxShadow:
                    "inset 0 0 0 10px color-mix(in oklch, var(--felt) 80%, black), inset 0 0 0 11px color-mix(in oklch, var(--primary) 25%, transparent), inset 0 0 80px color-mix(in oklch, black 55%, transparent)",
                }}
              >
                {/* Watermark */}
                <span
                  className="pointer-events-none absolute left-1/2 top-[28%] -translate-x-1/2 font-heading italic text-sm tracking-[0.2em] text-primary/35"
                >
                  PokerLM · {room.name}
                </span>

                {Array.from({ length: room.maxSeats }).map((_, idx) => {
                  const seat = room.seats.find((s) => s.seatIndex === idx);
                  const sState = state?.seats[idx];
                  const pos = rotate(idx);
                  const isToAct = toActSeatIndex === idx;
                  const isYou = !!(seat && me && seat.userId === me._id);
                  const folded = sState?.status === "folded";
                  const showHole = !!(sState?.hole && (isYou || game?.status === "complete"));
                  const initial = (seat?.player?.name || "?").trim().charAt(0).toUpperCase();
                  const tagText = folded
                    ? "folded"
                    : isToAct
                    ? "thinking…"
                    : sState?.status === "all_in"
                    ? "all-in"
                    : dealerIndex === idx
                    ? "BTN"
                    : sState?.streetBet
                    ? "in"
                    : "";
                  const tagTone = folded
                    ? "bg-destructive/20 text-destructive"
                    : isToAct
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/40 text-white/75";

                  if (!seat) {
                    return (
                      <div
                        key={idx}
                        className="absolute grid min-w-[180px] max-w-[220px] grid-cols-[44px_1fr] items-center gap-2.5 rounded-[14px] border border-dashed border-white/15 bg-background/40 px-3 py-2.5 opacity-55 backdrop-blur-sm"
                        style={SEAT_STYLE[pos]}
                      >
                        <Avatar className="pl-av size-11 border-dashed text-white/40">
                          <AvatarFallback className="bg-transparent">·</AvatarFallback>
                        </Avatar>
                        <div className="grid min-w-0 gap-0.5">
                          <span className="truncate text-[13.5px] text-white/95">Empty seat</span>
                          <span className="font-mono text-[10.5px] text-white/55">seat {idx + 1}</span>
                          {room.status === "waiting" && !mySeat && myPlayers && myPlayers.length > 0 && (
                            <div className="mt-1">
                              <Button
                                variant="outline"
                                size="xs"
                                type="button"
                                onClick={() => {
                                  const pid = selectedPlayer || (myPlayers[0]?._id as Id<"players">);
                                  if (!pid) return;
                                  void sit({ roomId, playerId: pid });
                                }}
                              >Sit</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "absolute grid min-w-[180px] max-w-[220px] grid-cols-[44px_1fr] items-center gap-2.5 rounded-[14px] border bg-background/60 px-3 py-2.5 backdrop-blur-sm",
                        "border-white/10",
                        isToAct && "border-primary/60 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent),0_0_28px_-4px_color-mix(in_oklch,var(--primary)_50%,transparent)]",
                        isYou && "border-chip/50 shadow-[0_0_0_1px_color-mix(in_oklch,var(--chip)_25%,transparent),0_0_22px_-8px_color-mix(in_oklch,var(--chip)_40%,transparent)]",
                        folded && "opacity-50",
                      )}
                      style={SEAT_STYLE[pos]}
                    >
                      <Avatar className="pl-av size-11 text-lg">
                        <AvatarFallback className="bg-transparent">{initial}</AvatarFallback>
                      </Avatar>
                      <div className="grid min-w-0 gap-0.5">
                        <span className="truncate text-[13.5px] text-white/95">
                          {seat.player?.name ?? "?"}
                          {isYou && (
                            <span className="ml-1.5 font-mono text-[9.5px] text-chip">YOU</span>
                          )}
                        </span>
                        <span className="truncate font-mono text-[10.5px] text-white/55">
                          {seat.player?.model ?? ""}
                        </span>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="font-mono tabular-nums text-xs text-white/95">
                            ${sState?.stack ?? seat.stack}
                          </span>
                          {tagText && (
                            <span className={cn("rounded-full px-1.5 py-px font-mono text-[9.5px] tracking-wide", tagTone)}>
                              {tagText}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Hole cards */}
                      <div
                        className="absolute flex"
                        style={HOLE_STYLE[pos]}
                      >
                        {showHole && sState?.hole ? (
                          sState.hole.map((c, i) => (
                            <div key={i} className={i > 0 ? "-ml-2.5" : ""}>
                              <CardFace card={c} size="sm" />
                            </div>
                          ))
                        ) : sState ? (
                          <>
                            <CardBack size="sm" />
                            <div className="-ml-2.5"><CardBack size="sm" /></div>
                          </>
                        ) : null}
                      </div>

                      {sState && sState.streetBet > 0 && (
                        <div
                          className="absolute flex items-center gap-1.5 rounded-full border border-white/10 bg-background/70 py-1 pl-1.5 pr-2.5 font-mono tabular-nums text-xs text-white/95"
                          style={BET_STYLE[pos]}
                        >
                          <span className="pl-chip !size-[18px]" />
                          <span>${sState.streetBet}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {dealerIndex !== undefined && dealerIndex !== null && (
                  <span
                    className="absolute z-10 grid size-6 place-items-center rounded-full border-2 font-heading text-xs font-medium"
                    style={{
                      ...DEALER_STYLE[rotate(dealerIndex)],
                      background: "oklch(0.97 0.01 85)",
                      color: "oklch(0.14 0.02 155)",
                      borderColor: "oklch(0.14 0.02 155)",
                      boxShadow:
                        "0 0 0 1.5px oklch(0.97 0.01 85), 0 4px 10px -2px color-mix(in oklch, black 60%, transparent)",
                    }}
                  >
                    D
                  </span>
                )}

                {/* Center stage */}
                <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center gap-4">
                  <div className="flex gap-3">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const c = community[i];
                      return c ? <CardFace key={i} card={c} /> : <CardBack key={i} />;
                    })}
                  </div>
                  <div className="grid justify-items-center gap-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
                      Pot · {street}
                    </div>
                    <div className="font-mono tabular-nums text-[32px] leading-none tracking-tight text-white/95">
                      ${pot}
                    </div>
                    <div className="mt-1 flex -space-x-2">
                      <span className="pl-chip" />
                      <span className="pl-chip" />
                      <span className="pl-chip" />
                      <span className="pl-chip" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Thinking pane */}
            <Card className="grid grid-rows-[auto_1fr_auto] gap-0 overflow-hidden py-0">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-3.5">
                <div className="flex items-baseline gap-2 text-sm font-medium">
                  Thinking log
                  <em className="font-heading text-[13px] font-normal italic text-muted-foreground">· live</em>
                </div>
                <Tabs defaultValue="all">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="grid max-h-[560px] gap-3 overflow-y-auto px-5 py-3.5">
                {recent.length === 0 && (
                  <div className="py-1.5 text-center font-heading text-[13px] italic text-muted-foreground">
                    — no actions yet —
                  </div>
                )}
                {[...recent].reverse().map((a) => {
                  const seat = room.seats.find((s) => s.seatIndex === a.seatIndex);
                  const initial = (seat?.player?.name || "?").trim().charAt(0).toUpperCase();
                  const actionTone =
                    a.kind === "fold"
                      ? "text-destructive"
                      : a.kind === "raise" || a.kind === "bet"
                      ? "text-primary"
                      : "text-primary";
                  const actionText =
                    a.kind === "fold" ? "folds" :
                    a.kind === "check" ? "checks" :
                    a.kind === "call" ? `calls $${a.amount ?? 0}` :
                    a.kind === "bet" ? `bets → $${a.amount ?? 0}` :
                    a.kind === "raise" ? `raises → $${a.amount ?? 0}` :
                    a.kind === "all_in" ? `all-in $${a.amount ?? 0}` :
                    a.kind;
                  return (
                    <div key={a._id} className="grid gap-2 rounded-[10px] border border-border bg-background/30 px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="flex items-center gap-1.5">
                          <Avatar className="pl-av size-[22px] text-[11px]">
                            <AvatarFallback className="bg-transparent">{initial}</AvatarFallback>
                          </Avatar>
                          {seat?.player?.name ?? `seat ${a.seatIndex + 1}`}
                        </span>
                        <span className="font-mono text-[10.5px] text-muted-foreground">{a.street}</span>
                      </div>
                      {a.rawLLM && (
                        <div className="font-heading text-[13.5px] italic leading-relaxed text-foreground/90">
                          <em className="not-italic text-primary">&ldquo;</em>
                          {a.rawLLM.slice(0, 240)}
                          <em className="not-italic text-primary">&rdquo;</em>
                        </div>
                      )}
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className={actionTone}>{actionText}</span>
                        <span className="text-muted-foreground">
                          {a.thinkingMs ? `${(a.thinkingMs / 1000).toFixed(1)}s` : seat?.player?.model ?? ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {toActSeat && (
                  <div className="grid gap-2 rounded-[10px] border border-primary/45 bg-primary/10 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="flex items-center gap-1.5">
                        <Avatar className="pl-av size-[22px] text-[11px]">
                          <AvatarFallback className="bg-transparent">
                            {(toActSeat.player?.name || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {toActSeat.player?.name}
                      </span>
                      <span className="font-mono text-[10.5px] text-muted-foreground">acting now</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-primary">deciding…</span>
                      <span className="text-muted-foreground">{toActSeat.player?.model ?? ""}</span>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t border-border px-5 py-3 font-mono text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <span className="size-1.5 rounded-full bg-current animate-pulse" />
                  streaming
                </span>
                <span>hand {handNumber ?? "—"}</span>
              </CardFooter>
            </Card>
          </div>

          {/* Sit selector when waiting + no seat */}
          {room.status === "waiting" && !mySeat && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[14px] border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
              {myPlayers && myPlayers.length === 0 ? (
                <>
                  <span>You don&apos;t have any players yet.</span>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/roster">Create one →</Link>
                  </Button>
                </>
              ) : (
                <>
                  <span>Take a seat:</span>
                  <select
                    className="w-[280px] rounded-md border border-border bg-transparent px-2 py-1.5 font-mono text-xs text-foreground"
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value as Id<"players">)}
                  >
                    <option value="">Choose a player…</option>
                    {myPlayers?.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.model})</option>)}
                  </select>
                  <Button
                    size="sm"
                    disabled={!selectedPlayer}
                    onClick={() => selectedPlayer && sit({ roomId, playerId: selectedPlayer as Id<"players"> })}
                  >Sit</Button>
                </>
              )}
            </div>
          )}

          {/* Thinking indicator — quiet badge while the current seat's bot decides */}
          {game?.status === "in_progress" && toActSeat && (
            <div className="mt-5 flex items-center gap-3 rounded-[14px] border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
              <span>
                <em className="font-heading italic text-foreground/80">
                  {toActSeat.player?.name ?? "Seat " + toActSeatIndex}
                </em>{" "}
                is thinking
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                · {toActSeat.player?.model ?? "—"}
              </span>
              {!apiKey && (
                <span className="ml-auto font-mono text-[11px] text-destructive">
                  paste your OpenRouter key in the nav to let the bots play
                </span>
              )}
            </div>
          )}

          {/* Hand history + session stats */}
          <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="overflow-hidden py-0">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-3.5">
                <div className="flex items-baseline gap-2 text-sm font-medium">
                  Hand action log
                  <em className="font-heading text-[13px] font-normal italic text-muted-foreground">
                    · #{handNumber ? String(handNumber).padStart(4, "0") : "—"}
                  </em>
                </div>
                <div className="flex gap-1.5">
                  {(["preflop", "flop", "turn", "river"] as const).map((s) => (
                    <Badge
                      key={s}
                      variant={street === s ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="px-0 py-0">
                {recent.length === 0 ? (
                  <div className="py-6 text-center font-heading italic text-muted-foreground">
                    No actions yet this hand.
                  </div>
                ) : (
                  recent.map((a) => {
                    const seat = room.seats.find((s) => s.seatIndex === a.seatIndex);
                    const initial = (seat?.player?.name || "?").trim().charAt(0).toUpperCase();
                    const tone =
                      a.kind === "fold"
                        ? "text-destructive border-destructive/35"
                        : a.kind === "raise" || a.kind === "bet"
                        ? "text-primary border-primary/35"
                        : "text-muted-foreground border-border";
                    return (
                      <div
                        key={a._id}
                        className="grid grid-cols-[60px_36px_1fr_auto_auto] items-center gap-3.5 border-b border-dashed border-border px-5 py-2.5 last:border-b-0"
                      >
                        <span className="font-mono text-[11px] text-muted-foreground">{a.street}</span>
                        <Avatar className="pl-av size-[26px] text-xs">
                          <AvatarFallback className="bg-transparent">{initial}</AvatarFallback>
                        </Avatar>
                        <span className="text-[13px] leading-snug">
                          <span className="mr-1 font-mono text-[11.5px] text-muted-foreground">
                            {seat?.player?.name ?? `seat ${a.seatIndex + 1}`}
                          </span>
                          {a.kind}
                          {a.rawLLM && (
                            <em className="font-heading italic text-foreground/70">
                              {" "}— &ldquo;{a.rawLLM.slice(0, 80).replace(/\s+/g, " ").trim()}&rdquo;
                            </em>
                          )}
                        </span>
                        <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase", tone)}>
                          {a.kind}
                        </span>
                        <span
                          className={cn(
                            "font-mono tabular-nums text-[13px]",
                            a.kind === "fold" && "text-destructive",
                          )}
                        >
                          {a.amount ? `$${a.amount}` : "—"}
                        </span>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden py-0">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-3.5">
                <div className="flex items-baseline gap-2 text-sm font-medium">
                  This session
                  <em className="font-heading text-[13px] font-normal italic text-muted-foreground">· stats</em>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2.5 px-5 py-3.5">
                <div className="grid gap-2 rounded-[10px] border border-border bg-background/30 px-3.5 py-3 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span>Hand #</span>
                    <span className="tabular-nums text-muted-foreground">{handNumber ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Players seated</span>
                    <span className="tabular-nums text-muted-foreground">{room.seats.length} / {room.maxSeats}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Blinds</span>
                    <span className="tabular-nums text-muted-foreground">${room.smallBlind} / ${room.bigBlind}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Buy-in</span>
                    <span className="tabular-nums text-muted-foreground">${room.startingStack}</span>
                  </div>
                </div>
                <div className="py-1.5 text-center font-heading text-[13px] italic text-muted-foreground">
                  — more session stats coming —
                </div>
              </CardContent>
            </Card>
          </div>
        </Show>
      </main>
    </SiteShell>
  );
}
