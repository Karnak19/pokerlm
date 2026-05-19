"use client";

/*
 * Slim room-creation form. The Convex `rooms.create` mutation only
 * accepts { name, maxSeats, smallBlind, bigBlind, startingStack }, so
 * anything beyond that was dead UI.
 *
 * Features intentionally cut (2026-05-19) — bring back when there's a
 * real reason and the schema has somewhere to put them:
 *   - Room description (free-text). Needs a `description` field on `rooms`.
 *   - Privacy mode: public / invite / private. Needs a `visibility` field
 *     and an invite-token table; affects `rooms.listOpen` filtering.
 *   - House rules: auto-deal, show thinking, time bank, ranked. Each is
 *     a separate boolean on `rooms` plus engine wiring.
 *   - Stack slider in BB units + custom chip amount. Today the four
 *     stakes presets pin starting stack to 100 BB; expose a slider when
 *     someone actually wants 200 BB / 50 BB tables.
 *   - Cost-of-play breakdown card. Needs real OpenRouter price lookup
 *     and an expected-tokens-per-hand estimate.
 *   - Sticky preview pane (felt mock + summary grid). Pretty but adds
 *     nothing once the form is three fields.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Show, SignInButton } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type StakePreset = {
  id: string;
  label: string;
  sb: number;
  bb: number;
};

// Starting stack pinned at 100 BB (standard cash-game depth).
const STAKES: StakePreset[] = [
  { id: "micro", label: "Micro", sb: 5, bb: 10 },
  { id: "low", label: "Low", sb: 25, bb: 50 },
  { id: "mid", label: "Mid", sb: 50, bb: 100 },
  { id: "high", label: "High", sb: 100, bb: 200 },
];

const SEAT_OPTIONS = [2, 3, 4, 6] as const;
type Seats = (typeof SEAT_OPTIONS)[number];

export default function NewRoomPage() {
  const router = useRouter();
  const create = useMutation(api.rooms.create);

  const [name, setName] = useState("");
  const [seats, setSeats] = useState<Seats>(6);
  const [stake, setStake] = useState<StakePreset>(STAKES[1]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const id = await create({
        name: name.trim() || "Room",
        maxSeats: seats,
        smallBlind: stake.sb,
        bigBlind: stake.bb,
        startingStack: stake.bb * 100,
      });
      router.push(`/rooms/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create room");
      setSubmitting(false);
    }
  }

  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-[1400px] px-10">
        <header className="grid grid-cols-1 items-end gap-6 pt-12 pb-7 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-3.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">/</Link>
              <span className="text-muted-foreground/50">›</span>
              <Link href="/rooms" className="hover:text-foreground">rooms</Link>
              <span className="text-muted-foreground/50">›</span>
              <span className="text-foreground">new</span>
            </div>
            <h1 className="font-heading text-5xl font-normal leading-[0.98] tracking-tighter text-balance md:text-6xl">
              Build a <em className="italic text-foreground/60">table</em>.
            </h1>
            <p className="mt-3.5 max-w-[58ch] text-[15.5px] leading-relaxed text-muted-foreground">
              Name it, pick how many seats, choose the stakes. Starting stack
              is 100 BB. You can sit your own player once the room exists.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rooms">← Back to rooms</Link>
          </Button>
        </header>

        <Show when="signed-out">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
            <p className="mb-4 text-muted-foreground">Sign in to create a room.</p>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
          </div>
        </Show>

        <Show when="signed-in">
          <form
            onSubmit={onSubmit}
            className="mx-auto grid max-w-2xl gap-8 pb-16"
          >
            <div className="grid gap-2.5">
              <Label htmlFor="room-name" className="font-mono text-[10.5px] uppercase tracking-[0.14em]">
                Name
              </Label>
              <Input
                id="room-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Salon B"
                maxLength={60}
                autoFocus
                required
              />
            </div>

            <div className="grid gap-2.5">
              <Label className="font-mono text-[10.5px] uppercase tracking-[0.14em]">
                Seats
              </Label>
              <Tabs value={String(seats)} onValueChange={(v) => setSeats(Number(v) as Seats)}>
                <TabsList className="grid w-full grid-cols-4">
                  {SEAT_OPTIONS.map((n) => (
                    <TabsTrigger key={n} value={String(n)}>
                      {n}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-2.5">
              <Label className="font-mono text-[10.5px] uppercase tracking-[0.14em]">
                Stakes
              </Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {STAKES.map((s) => {
                  const on = s.id === stake.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStake(s)}
                      className={cn(
                        "grid gap-1 rounded-lg border bg-card p-3 text-left transition-colors",
                        on
                          ? "border-primary/60 bg-primary/10"
                          : "border-border hover:border-primary/30 hover:bg-input/30",
                      )}
                    >
                      <span className="text-sm">{s.label}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {s.sb} / {s.bb}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">
                Starting stack · {(stake.bb * 100).toLocaleString("en-US")} chips (100 BB)
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" asChild>
                <Link href="/rooms">Cancel</Link>
              </Button>
              <Button type="submit" disabled={submitting || !name.trim()}>
                {submitting ? "Creating…" : "Create room"}
              </Button>
            </div>
          </form>
        </Show>
      </main>
    </SiteShell>
  );
}
