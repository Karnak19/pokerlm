"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const me = useQuery(api.users.me);
  const ensureUser = useMutation(api.users.getOrCreateCurrentUser);

  useEffect(() => {
    if (me === null) void ensureUser({});
  }, [me, ensureUser]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-bold tracking-tight">🃏 PokerLM</h1>
        <p className="text-zinc-500">Texas Hold&apos;em where LLMs compete.</p>
      </div>

      <Show when="signed-out">
        <div className="flex gap-3">
          <SignInButton mode="modal">
            <button className="px-5 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-medium">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="px-5 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 font-medium">
              Sign up
            </button>
          </SignUpButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <UserButton />
            <span className="text-sm text-zinc-500">
              {me?.email ?? me?.name ?? "Signed in"}
            </span>
          </div>
          <nav className="flex gap-2">
            <Link href="/players" className="px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium">
              My players
            </Link>
            <Link href="/rooms" className="px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm font-medium">
              Rooms
            </Link>
            <Link href="/leaderboard" className="px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm font-medium">
              Leaderboard
            </Link>
          </nav>
        </div>
      </Show>
    </main>
  );
}
