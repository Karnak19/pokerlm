"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";

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
  const submit = useMutation(api.games.submitAction);
  const dealNext = useMutation(api.games.startNextHand);
  const decide = useAction(api.openrouter.decide);

  const [selectedPlayer, setSelectedPlayer] = useState<Id<"players"> | "">("");
  const [raiseAmount, setRaiseAmount] = useState("");
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("pokerlm.openrouter.key") ?? "";
  });
  const [autoPlay, setAutoPlay] = useState(true);
  const deciding = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (apiKey) sessionStorage.setItem("pokerlm.openrouter.key", apiKey);
      else sessionStorage.removeItem("pokerlm.openrouter.key");
    }
  }, [apiKey]);

  const mySeat = me && room ? room.seats.find((s) => s.userId === me._id) : undefined;
  const isCreator = !!me && !!room && me._id === room.createdBy;

  const state = game?.state;
  const toActSeatIndex = state?.toAct ?? null;
  const toActSeat = toActSeatIndex !== null && toActSeatIndex !== undefined && room
    ? room.seats.find((s) => s.seatIndex === toActSeatIndex)
    : undefined;
  const isMyTurn = toActSeat && mySeat && toActSeat._id === mySeat._id;

  // Auto-play: when one of my seats is to act, call OpenRouter with my key.
  useEffect(() => {
    if (!autoPlay || !apiKey || !game || game.status !== "in_progress" || !me) return;
    if (toActSeat?.userId !== me._id) return;
    const tag = `${game.gameId}:${toActSeatIndex}:${game.recentActions.length}`;
    if (deciding.current === tag) return;
    deciding.current = tag;
    void decide({ gameId: game.gameId, apiKey }).catch((e) => {
      console.error("decide failed", e);
    }).finally(() => {
      setTimeout(() => { if (deciding.current === tag) deciding.current = null; }, 1000);
    });
  }, [autoPlay, apiKey, game, me, toActSeat, toActSeatIndex, decide]);

  if (room === undefined) return <main className="p-8">Loading…</main>;
  if (room === null) return <main className="p-8">Room not found.</main>;

  async function act(kind: "fold" | "check" | "call" | "all_in") {
    if (!game) return;
    await submit({ gameId: game.gameId, action: { kind } });
  }
  async function actRaise() {
    if (!game) return;
    const amt = parseInt(raiseAmount, 10);
    if (!Number.isFinite(amt)) return;
    const kind = state!.currentBet === 0 ? "bet" : "raise";
    await submit({ gameId: game.gameId, action: { kind, amount: amt } as never });
    setRaiseAmount("");
  }

  return (
    <main className="flex-1 w-full max-w-4xl mx-auto p-6 space-y-4">
      <header className="flex items-center justify-between">
        <Link href="/rooms" className="text-sm text-zinc-500 hover:underline">← Rooms</Link>
        <h1 className="text-xl font-semibold">{room.name}</h1>
        <div className="text-xs text-zinc-500">{room.status}</div>
      </header>

      <Show when="signed-out">
        <SignInButton mode="modal"><button className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm">Sign in to play</button></SignInButton>
      </Show>

      <Show when="signed-in">
        {/* Felt */}
        <div className="rounded-3xl bg-emerald-900/90 text-emerald-50 p-6 min-h-[280px] relative">
          <div className="text-center space-y-2">
            <div className="text-xs uppercase tracking-wider text-emerald-200/70">
              Pot
            </div>
            <motion.div
              key={state?.pot ?? 0}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="text-3xl font-bold"
            >
              {state?.pot ?? 0}
            </motion.div>
            <div className="flex gap-2 justify-center mt-2 min-h-[40px]">
              <AnimatePresence>
                {state?.community.map((c, i) => (
                  <motion.div
                    key={`${i}-${c}`}
                    initial={{ rotateY: 180, opacity: 0, y: -20 }}
                    animate={{ rotateY: 0, opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, type: "spring", stiffness: 200, damping: 18 }}
                    className="w-9 h-12 bg-white text-zinc-900 rounded flex items-center justify-center font-mono text-sm shadow"
                  >
                    {c}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="text-xs text-emerald-200/70 mt-1">
              {state ? `${state.street} · hand #${game!.handNumber}` : "Waiting to start"}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: room.maxSeats }).map((_, idx) => {
              const seat = room.seats.find((s) => s.seatIndex === idx);
              const sState = state?.seats[idx];
              const isDealer = state?.dealerIndex === idx;
              const isToAct = toActSeatIndex === idx;
              return (
                <motion.div
                  key={idx}
                  animate={isToAct ? { scale: [1, 1.03, 1], borderColor: ["#fde047", "#facc15", "#fde047"] } : { scale: 1 }}
                  transition={isToAct ? { repeat: Infinity, duration: 1.6 } : { duration: 0.2 }}
                  className={`p-3 rounded-lg border ${isToAct ? "border-yellow-300 bg-yellow-900/40" : "border-emerald-700 bg-emerald-800/50"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase opacity-70">Seat {idx + 1}{isDealer ? " · D" : ""}</span>
                    {sState && <span className="text-xs">{sState.status}</span>}
                  </div>
                  {seat ? (
                    <>
                      <div className="font-medium truncate">{seat.player?.name ?? "?"}</div>
                      <div className="text-xs opacity-70 font-mono truncate">{seat.player?.model}</div>
                      <div className="text-sm mt-1">
                        Stack: {sState?.stack ?? seat.stack}
                        {sState && sState.streetBet > 0 && (
                          <span className="ml-2 text-yellow-300">+{sState.streetBet}</span>
                        )}
                      </div>
                      {sState?.hole && (seat.userId === me?._id || game?.status === "complete") && (
                        <div className="flex gap-1 mt-1">
                          {sState.hole.map((c: string, i: number) => (
                            <motion.div
                              key={i}
                              initial={{ rotateY: 180, opacity: 0 }}
                              animate={{ rotateY: 0, opacity: 1 }}
                              transition={{ delay: 0.1 + i * 0.1 }}
                              className="w-7 h-10 bg-white text-zinc-900 rounded text-xs font-mono flex items-center justify-center"
                            >
                              {c}
                            </motion.div>
                          ))}
                        </div>
                      )}
                      {isToAct && (
                        <div className="text-xs mt-1 text-yellow-200 italic">thinking…</div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm opacity-70 italic">empty</div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* API key + auto-play */}
        <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-zinc-500">OpenRouter key:</span>
            <input
              type="password"
              placeholder="sk-or-…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono w-64"
            />
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} />
            Auto-play my seat
          </label>
          <a
            href="https://openrouter.ai/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Create one →
          </a>
          <span className="text-xs text-zinc-500">Held in memory + sessionStorage only · never sent to our database</span>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {room.status === "waiting" && !mySeat && (
            myPlayers && myPlayers.length === 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">You don&apos;t have any players yet.</span>
                <Link href="/players" className="px-3 py-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-medium">
                  Create one →
                </Link>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <select
                  className="px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value as Id<"players">)}
                >
                  <option value="">Choose a player…</option>
                  {myPlayers?.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.model})</option>)}
                </select>
                <button
                  disabled={!selectedPlayer}
                  onClick={() => selectedPlayer && sit({ roomId, playerId: selectedPlayer as Id<"players"> })}
                  className="px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm disabled:opacity-50"
                >
                  Sit
                </button>
              </div>
            )
          )}
          {room.status === "waiting" && mySeat && (
            <div className="flex gap-2">
              <button onClick={() => leave({ roomId })} className="px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm">Leave</button>
              {isCreator && room.seats.length >= 2 && (
                <button onClick={() => start({ roomId })} className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-sm">Start game</button>
              )}
            </div>
          )}

          {game?.status === "in_progress" && isMyTurn && (
            <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg border border-yellow-400/50 bg-yellow-50 dark:bg-yellow-950/30">
              <span className="text-sm font-medium">Your turn</span>
              <button onClick={() => act("fold")} className="px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm">Fold</button>
              <button onClick={() => act("check")} className="px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm">Check</button>
              <button onClick={() => act("call")} className="px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm">Call</button>
              <input
                type="number"
                placeholder="amount"
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(e.target.value)}
                className="w-24 px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
              />
              <button onClick={actRaise} className="px-3 py-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm">
                {state?.currentBet === 0 ? "Bet" : "Raise"}
              </button>
              <button onClick={() => act("all_in")} className="px-3 py-1.5 rounded-full bg-red-600 text-white text-sm">All-in</button>
            </div>
          )}

          {game?.status === "complete" && isCreator && (
            <button onClick={() => dealNext({ roomId })} className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm">
              Deal next hand
            </button>
          )}
        </div>

        {/* Action log */}
        {game?.recentActions && game.recentActions.length > 0 && (
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
            {game.recentActions.map((a) => (
              <div key={a._id}>
                seat {a.seatIndex + 1} · {a.kind}{a.amount ? ` ${a.amount}` : ""} ({a.street})
              </div>
            ))}
          </div>
        )}
      </Show>
    </main>
  );
}
