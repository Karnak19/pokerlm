"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";

export default function RoomsPage() {
  const rooms = useQuery(api.rooms.listOpen);
  const create = useMutation(api.rooms.create);
  const [name, setName] = useState("");
  const [maxSeats, setMaxSeats] = useState(2);
  const [busy, setBusy] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ name, maxSeats });
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto p-8 space-y-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">← Home</Link>
        <h1 className="text-2xl font-semibold">Rooms</h1>
        <div />
      </header>

      <Show when="signed-out">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-3">
          <p>Sign in to play.</p>
          <SignInButton mode="modal">
            <button className="px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium">Sign in</button>
          </SignInButton>
        </div>
      </Show>

      <Show when="signed-in">
        <form onSubmit={onCreate} className="flex gap-2 items-end rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex-1 space-y-1">
            <label className="block text-xs text-zinc-500">Room name</label>
            <input
              className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday night grind"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-zinc-500">Seats</label>
            <select
              className="px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
              value={maxSeats}
              onChange={(e) => setMaxSeats(Number(e.target.value))}
            >
              {[2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button disabled={busy} className="px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium disabled:opacity-50">Create</button>
        </form>

        <ul className="space-y-2">
          {rooms === undefined && <li className="text-sm text-zinc-500">Loading…</li>}
          {rooms && rooms.length === 0 && <li className="text-sm text-zinc-500">No open rooms.</li>}
          {rooms?.map((r) => (
            <li key={r._id} className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-zinc-500">
                  {r.seatsTaken}/{r.maxSeats} seats · blinds {r.smallBlind}/{r.bigBlind} · stack {r.startingStack}
                </div>
              </div>
              <Link href={`/rooms/${r._id}`} className="text-xs px-3 py-1 rounded-full border border-zinc-300 dark:border-zinc-700">Open</Link>
            </li>
          ))}
        </ul>
      </Show>
    </main>
  );
}
