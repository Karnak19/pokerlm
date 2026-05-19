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
import { AnimatePresence, motion } from "framer-motion";
import { PlayerAvatar } from "@/components/player-avatar";
import { useCardSound, useChipSound, useSoundMute } from "@/lib/sounds";
import { Volume2, VolumeX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SUIT_GLYPH: Record<string, string> = { h: "♥", d: "♦", s: "♠", c: "♣" };
const RED_SUITS = new Set(["h", "d"]);

function parseCard(c: string): { rank: string; suit: string; glyph: string; red: boolean } | null {
  if (!c || c.length < 2) return null;
  const raw = c.slice(0, c.length - 1).toUpperCase();
  const suit = c.slice(-1).toLowerCase();
  const glyph = SUIT_GLYPH[suit];
  if (!glyph) return null;
  // Storage uses single-char ranks ("T" for ten) so every card fits in two
  // chars. Display unswaps T → 10 because that's what humans expect.
  const rank = raw === "T" ? "10" : raw;
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

function MuteToggle() {
  const { isMuted, toggle, mounted } = useSoundMute();
  // Render a neutral icon until mounted so SSR and CSR match.
  const showMuted = mounted && isMuted;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={showMuted ? "Unmute sounds" : "Mute sounds"}
      title={showMuted ? "Unmute sounds" : "Mute sounds"}
    >
      {showMuted ? <VolumeX /> : <Volume2 />}
    </Button>
  );
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

// Approximate seat → pot-center offset in px (table is ~540px tall, ~1100px wide
// at the default xl breakpoint). The chip-fly animates from these deltas toward
// (0, 0) at table center. Approximate is fine — the chip is decorative.
const SEAT_OFFSET_FROM_CENTER: Array<[number, number]> = [
  [0, -240],     // 0 top
  [430, -110],   // 1 top right
  [430, 110],    // 2 bottom right
  [0, 240],      // 3 bottom
  [-430, 110],   // 4 bottom left
  [-430, -110],  // 5 top left
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
  const leaveAfterHand = useMutation(api.rooms.leaveAfterHand);
  const start = useMutation(api.rooms.start);
  const decide = useAction(api.openrouter.decide);

  const [selectedPlayer, setSelectedPlayer] = useState<Id<"players"> | "">("");
  const [sitError, setSitError] = useState<string | null>(null);

  // Tick a clock client-side so the elapsed counter on the active seat
  // updates smoothly without waking up the whole tree per ms. Refreshes
  // every 150ms while a seat is to act.
  const [elapsedMs, setElapsedMs] = useState(0);
  /* eslint-disable react-hooks/set-state-in-effect -- ticking client-only clock */
  useEffect(() => {
    const since = game?.currentSeatToActSince;
    if (!since || game?.status !== "in_progress") {
      setElapsedMs(0);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - since);
    tick();
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [game?.currentSeatToActSince, game?.status]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function trySit(playerId: Id<"players">) {
    setSitError(null);
    try {
      await sit({ roomId, playerId });
    } catch (e) {
      setSitError(e instanceof Error ? e.message : "Sit failed");
    }
  }
  // Read once at mount; the OpenRouter-key chip in the nav owns writes to sessionStorage.
  const apiKey = useMemo(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("pokerlm.openrouter.key") ?? "";
  }, []);
  const deciding = useRef<string | null>(null);

  // Chip-fly queue: each entry is a short-lived flight from a seat to the pot.
  type ChipFlight = { id: number; seatIndex: number; amount: number };
  const [flights, setFlights] = useState<ChipFlight[]>([]);
  const lastSeenActionId = useRef<string | null>(null);
  const playCard = useCardSound();
  const playChip = useChipSound();

  /* eslint-disable react-hooks/set-state-in-effect -- enqueue a transient animation in response to new actions arriving */
  useEffect(() => {
    const actions = game?.recentActions;
    if (!actions || actions.length === 0) return;
    const newest = actions[actions.length - 1];
    const tag = `${newest._id}`;
    if (lastSeenActionId.current === tag) return;
    const first = lastSeenActionId.current === null;
    lastSeenActionId.current = tag;
    // On first mount, prime the marker without animating historical bets.
    if (first) return;
    const chipKinds = new Set(["bet", "raise", "call", "all_in"]);
    if (!chipKinds.has(newest.kind)) return;
    setFlights((f) => [...f, { id: newest._creationTime, seatIndex: newest.seatIndex, amount: newest.amount }]);
    playChip();
  }, [game?.recentActions]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Card sound on hand start. Tracks handNumber transitions; firing
  // once per real new hand (not on initial mount).
  const lastHandNumber = useRef<number | null>(null);
  useEffect(() => {
    const h = game?.handNumber ?? null;
    if (h === null) return;
    if (lastHandNumber.current === null) {
      lastHandNumber.current = h;
      return;
    }
    if (h !== lastHandNumber.current) {
      lastHandNumber.current = h;
      playCard();
    }
  }, [game?.handNumber]);

  // Card sound on each new community card reveal (flop/turn/river).
  const lastCommunityLen = useRef<number>(0);
  useEffect(() => {
    const n = game?.state?.community?.length ?? 0;
    if (n > lastCommunityLen.current) playCard();
    lastCommunityLen.current = n;
  }, [game?.state?.community?.length]);

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
            <MuteToggle />
            {room.status === "waiting" && isCreator && room.seats.length >= 2 && (
              <Button onClick={() => start({ roomId })}>Start game</Button>
            )}
            {game?.status === "complete" && (
              <span className="inline-flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
                dealing next hand…
              </span>
            )}
            {mySeat && (() => {
              const live = room.status === "playing" && game?.status === "in_progress";
              if (!live) {
                return (
                  <Button variant="destructive" onClick={() => void leave({ roomId })}>
                    Leave table
                  </Button>
                );
              }
              return (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant={mySeat.leaveAfterHand ? "outline" : "destructive"}
                    >
                      {mySeat.leaveAfterHand ? "Leaving after hand" : "Leave table"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="font-heading font-normal">
                        Leave the <em className="italic text-foreground/60">table</em>?
                      </DialogTitle>
                      <DialogDescription>
                        A hand is in play. You can fold and walk now, or stay
                        until this hand resolves and leave between hands.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="!justify-between gap-3 sm:!justify-between">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (!mySeat.leaveAfterHand) void leaveAfterHand({ roomId });
                        }}
                        disabled={mySeat.leaveAfterHand}
                      >
                        {mySeat.leaveAfterHand ? "Already queued ✓" : "Leave after this hand"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void leave({ roomId })}
                      >
                        Fold &amp; leave now
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            })()}
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
                  // Live elapsed counter while this seat is to act.
                  const elapsedLabel = isToAct ? `${(elapsedMs / 1000).toFixed(1)}s` : "";
                  const tagText = folded
                    ? "folded"
                    : isToAct
                    ? elapsedLabel
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
                                  void trySit(pid);
                                }}
                              >Sit</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const anyoneActing =
                    toActSeatIndex !== null && toActSeatIndex !== undefined;
                  // Dim non-active seats so the table reads as "this one's turn".
                  const dimmed = anyoneActing && !isToAct && !folded;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "absolute grid min-w-[180px] max-w-[220px] grid-cols-[44px_1fr] items-center gap-2.5 rounded-[14px] border bg-background/60 px-3 py-2.5 backdrop-blur-sm transition-opacity duration-300",
                        "border-white/10",
                        isToAct && "border-primary/60 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent),0_0_28px_-4px_color-mix(in_oklch,var(--primary)_50%,transparent)]",
                        isYou && !isToAct && "border-chip/50 shadow-[0_0_0_1px_color-mix(in_oklch,var(--chip)_25%,transparent),0_0_22px_-8px_color-mix(in_oklch,var(--chip)_40%,transparent)]",
                        folded && "opacity-50",
                        dimmed && "opacity-70",
                      )}
                      style={SEAT_STYLE[pos]}
                    >
                      {/* Active-seat pulse — soft halo loop while this seat is thinking */}
                      {isToAct && !folded && (
                        <motion.span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 rounded-[14px]"
                          style={{
                            boxShadow: "0 0 0 2px color-mix(in oklch, var(--primary) 55%, transparent)",
                          }}
                          initial={{ opacity: 0.4, scale: 1 }}
                          animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.04, 1] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                      {isToAct && !folded ? (
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                          className="grid place-items-center"
                        >
                          <PlayerAvatar
                            seed={seat.playerId}
                            fallback={initial}
                            size={44}
                          />
                        </motion.div>
                      ) : (
                        <PlayerAvatar
                          seed={seat.playerId}
                          fallback={initial}
                          size={44}
                        />
                      )}
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

                      {/* Hole cards — keyed by hand# so deal-in fires per hand */}
                      <div
                        className="absolute flex"
                        style={HOLE_STYLE[pos]}
                      >
                        {sState && [0, 1].map((i) => {
                          const dealDelay = pos * 0.12 + i * 0.06;
                          return (
                            <motion.div
                              key={`${handNumber}-${i}`}
                              className={i > 0 ? "-ml-2.5" : ""}
                              initial={{ x: 0, y: -80, opacity: 0, rotate: -25, scale: 0.6 }}
                              animate={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                              transition={{ delay: dealDelay, duration: 0.34, ease: [0.2, 0.7, 0.3, 1] }}
                            >
                              {showHole && sState.hole?.[i] ? (
                                <CardFace card={sState.hole[i]} size="sm" />
                              ) : (
                                <CardBack size="sm" />
                              )}
                            </motion.div>
                          );
                        })}
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

                {/* Chip flights — short-lived motion chips from seat → pot when someone bets */}
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2"
                  style={{ width: 0, height: 0 }}
                  aria-hidden="true"
                >
                  <AnimatePresence>
                    {flights.map((f) => {
                      const [ox, oy] = SEAT_OFFSET_FROM_CENTER[f.seatIndex] ?? [0, 0];
                      return (
                        <motion.div
                          key={f.id}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          initial={{ x: ox, y: oy, opacity: 0, scale: 0.5 }}
                          animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.4 }}
                          transition={{ duration: 0.55, ease: [0.4, 0.0, 0.2, 1] }}
                          onAnimationComplete={() => {
                            setFlights((arr) => arr.filter((x) => x.id !== f.id));
                          }}
                        >
                          <span className="flex items-center gap-1.5 rounded-full bg-background/85 px-1 pr-2.5 py-0.5 font-mono tabular-nums text-[11px] text-white shadow-[0_8px_24px_-12px_color-mix(in_oklch,black_80%,transparent)] backdrop-blur-sm">
                            <span className="pl-chip !size-[16px]" />
                            <span>${f.amount}</span>
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Center stage */}
                <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center gap-4">
                  <div className="flex gap-3" style={{ perspective: 800 }}>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const c = community[i];
                      // Stagger so the flop deals as 3 quick flips, turn/river one each.
                      const flopBase = community.length === 3 ? i * 0.12 : 0;
                      return (
                        <AnimatePresence key={i} mode="wait">
                          {c ? (
                            <motion.div
                              key={`${handNumber}-${i}-${c}`}
                              initial={{ rotateY: 90, opacity: 0, y: -18 }}
                              animate={{ rotateY: 0, opacity: 1, y: 0 }}
                              transition={{ delay: flopBase, duration: 0.36, ease: [0.2, 0.7, 0.3, 1] }}
                              style={{ transformStyle: "preserve-3d" }}
                            >
                              <CardFace card={c} />
                            </motion.div>
                          ) : (
                            <CardBack key={`back-${i}`} />
                          )}
                        </AnimatePresence>
                      );
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
                          <PlayerAvatar
                            seed={seat?.playerId ?? `seat-${a.seatIndex}`}
                            fallback={initial}
                            size={22}
                          />
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
                        <PlayerAvatar
                          seed={toActSeat.playerId}
                          fallback={(toActSeat.player?.name || "?").charAt(0).toUpperCase()}
                          size={22}
                        />
                        {toActSeat.player?.name}
                      </span>
                      <span className="font-mono tabular-nums text-[10.5px] text-primary">
                        {(elapsedMs / 1000).toFixed(1)}s
                      </span>
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
                    {myPlayers?.map((p) => {
                      const roll = p.bankroll ?? 5000;
                      const retired = p.status === "retired";
                      const cantAfford = !retired && roll < room.startingStack;
                      const tag = retired
                        ? " · retired"
                        : cantAfford
                          ? ` · $${roll} (need $${room.startingStack})`
                          : ` · $${roll}`;
                      return (
                        <option
                          key={p._id}
                          value={p._id}
                          disabled={retired || cantAfford}
                        >
                          {p.name} ({p.model}){tag}
                        </option>
                      );
                    })}
                  </select>
                  <Button
                    size="sm"
                    disabled={!selectedPlayer}
                    onClick={() => selectedPlayer && void trySit(selectedPlayer as Id<"players">)}
                  >Sit (${room.startingStack})</Button>
                  {sitError && (
                    <span className="basis-full font-mono text-[11px] text-destructive">
                      {sitError}
                    </span>
                  )}
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
              <span className="font-mono tabular-nums text-[11px] text-primary">
                {(elapsedMs / 1000).toFixed(1)}s
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
                        <PlayerAvatar
                          seed={seat?.playerId ?? `seat-${a.seatIndex}`}
                          fallback={initial}
                          size={26}
                        />
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
