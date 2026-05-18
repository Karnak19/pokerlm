"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { applyAction, type GameState, type Action } from "@/engine/state";
import Link from "next/link";

export default function ReplayPage() {
  const params = useParams<{ id: string }>();
  const replayId = params.id as Id<"handHistories">;
  const data = useQuery(api.handHistories.get, { handHistoryId: replayId });
  const [step, setStep] = useState(0);

  const states = useMemo<GameState[] | null>(() => {
    if (!data) return null;
    const blob = JSON.parse(data.handHistory.replayBlob) as { initialState: GameState };
    let s = blob.initialState;
    const arr: GameState[] = [s];
    for (const a of data.actions) {
      const action = { kind: a.kind, ...(a.amount ? { amount: a.amount } : {}) } as Action;
      try { s = applyAction(s, action); } catch { break; }
      arr.push(s);
    }
    return arr;
  }, [data]);

  if (!data || !states) return <main className="p-8 text-sm text-zinc-500">Loading replay…</main>;
  const state = states[Math.min(step, states.length - 1)];

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto p-8 space-y-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">← Home</Link>
        <h1 className="text-xl font-semibold">Hand #{data.handHistory.handNumber} · replay</h1>
        <div />
      </header>

      <div className="rounded-3xl bg-emerald-900/90 text-emerald-50 p-6 min-h-[260px]">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-emerald-200/70">Pot</div>
          <div className="text-2xl font-bold">{state.pot}</div>
          <div className="flex gap-2 justify-center mt-2 min-h-[40px]">
            {state.community.map((c, i) => (
              <div key={i} className="w-9 h-12 bg-white text-zinc-900 rounded flex items-center justify-center font-mono text-sm shadow">{c}</div>
            ))}
          </div>
          <div className="text-xs text-emerald-200/70 mt-1">{state.street}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {state.seats.map((s, idx) => {
            const seat = data.seats.find((x) => x.seatIndex === idx);
            return (
              <div key={idx} className="p-3 rounded-lg border border-emerald-700 bg-emerald-800/50">
                <div className="text-xs uppercase opacity-70">Seat {idx + 1}{state.dealerIndex === idx ? " · D" : ""}</div>
                <div className="font-medium truncate">{seat?.player?.name ?? "empty"}</div>
                <div className="text-xs opacity-70 font-mono truncate">{seat?.player?.model}</div>
                <div className="text-sm mt-1">Stack: {s.stack} {s.streetBet > 0 && <span className="text-yellow-300">+{s.streetBet}</span>}</div>
                {s.hole && (
                  <div className="flex gap-1 mt-1">
                    {s.hole.map((c, i) => (
                      <div key={i} className="w-7 h-10 bg-white text-zinc-900 rounded text-xs font-mono flex items-center justify-center">{c}</div>
                    ))}
                  </div>
                )}
                <div className="text-xs mt-1">{s.status}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm">◀</button>
        <button onClick={() => setStep((s) => Math.min(states.length - 1, s + 1))} className="px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm">▶</button>
        <div className="text-xs text-zinc-500">Step {step + 1}/{states.length}</div>
        <input
          type="range"
          min={0}
          max={states.length - 1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
          className="flex-1"
        />
      </div>

      <ol className="text-xs font-mono space-y-1">
        {data.actions.map((a, i) => (
          <li key={a._id} className={i + 1 === step ? "text-yellow-600 dark:text-yellow-400" : "text-zinc-500"}>
            {i + 1}. seat {a.seatIndex + 1} · {a.kind}{a.amount ? ` ${a.amount}` : ""} ({a.street}){a.thinkingMs ? ` · ${a.thinkingMs}ms` : ""}
          </li>
        ))}
      </ol>
    </main>
  );
}
