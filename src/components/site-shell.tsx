"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Show, SignInButton, SignOutButton } from "@clerk/nextjs";
import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/rooms", label: "Rooms" },
  { href: "/roster", label: "Roster" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

const OR_STORAGE_KEY = "pokerlm.openrouter.key";
// Same-tab sessionStorage writes don't fire the `storage` event, so NavKey
// emits this whenever the key changes and the onboarding chip listens for it.
const KEY_CHANGED_EVENT = "pokerlm:key-changed";
// Step 1's action asks NavKey to open its popover.
const OPEN_KEY_EVENT = "pokerlm:open-key";

function readStoredKey(): string {
  try {
    return sessionStorage.getItem(OR_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function maskKey(k: string): string {
  if (!k) return "no key";
  return `•••• ${k.slice(-4)}`;
}

function NavKey() {
  const [reveal, setReveal] = useState(false);
  const [open, setOpen] = useState(false);
  // Server render = empty; we rehydrate from sessionStorage after mount to
  // avoid an SSR/CSR mismatch (sessionStorage is client-only).
  const [key, setKey] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- mount-time hydration from sessionStorage (client-only) */
  useEffect(() => {
    setMounted(true);
    const stored = readStoredKey();
    setKey(stored);
    setDraft(stored);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const openKey = () => setOpen(true);
    window.addEventListener(OPEN_KEY_EVENT, openKey);
    return () => window.removeEventListener(OPEN_KEY_EVENT, openKey);
  }, []);

  function persist(next: string) {
    const trimmed = next.trim();
    setKey(trimmed);
    setDraft(trimmed);
    try {
      if (trimmed) sessionStorage.setItem(OR_STORAGE_KEY, trimmed);
      else sessionStorage.removeItem(OR_STORAGE_KEY);
    } catch {}
    window.dispatchEvent(new Event(KEY_CHANGED_EVENT));
  }

  // Until mount, render a neutral chip so SSR and CSR match. After the
  // sessionStorage read in useEffect we know whether the key is empty.
  const empty = mounted && !key;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex h-[30px] items-center gap-2 rounded-full border px-2.5 font-mono text-[11.5px] transition-colors",
            empty
              ? "border-destructive/45 bg-destructive/10 text-destructive hover:bg-destructive/15"
              : "border-border bg-input/20 text-foreground hover:bg-input/40",
          )}
          aria-label="OpenRouter key"
        >
          <span
            className={cn(
              "size-1.5 rounded-full ring-[3px]",
              empty
                ? "animate-pulse bg-destructive ring-destructive/20"
                : "bg-primary ring-primary/20",
            )}
          />
          <span className="hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
            KEY
          </span>
          <span>{mounted ? maskKey(key) : "key"}</span>
          <ChevronDown className="size-2.5 text-muted-foreground transition-transform group-aria-expanded:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-90">
        <PopoverHeader className="flex flex-row items-baseline justify-between gap-2">
          <PopoverTitle className="font-heading text-lg font-normal tracking-tight">
            OpenRouter <em className="not-italic text-foreground/60">key</em>
          </PopoverTitle>
          <PopoverDescription
            className={cn(
              "inline-flex items-center gap-1.5 font-mono text-[10.5px]",
              empty && "text-destructive",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                empty ? "bg-destructive" : "bg-primary",
              )}
            />
            {empty ? "no key · paste to play" : "connected · session-only"}
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex gap-2">
          <Input
            type={reveal ? "text" : "password"}
            value={draft}
            placeholder="sk-or-v1-…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") persist(draft);
            }}
            className="font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={() => setReveal((r) => !r)}>
            {reveal ? "Hide" : "Reveal"}
          </Button>
        </div>
        <p className="border-t border-dashed border-border pt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          Stored in this browser session only — never written to our DB.{" "}
          <a
            href="https://openrouter.ai/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-[3px] hover:underline"
          >
            Create a capped throwaway key ↗
          </a>
        </p>
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => persist("")}>
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={() => persist(draft)}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type OnboardingStep = {
  label: string;
  done: boolean;
  cta: string;
  action: () => void;
};

// New-user onboarding checklist. Every step's done-ness is derived from real
// data, so it's honest and resumable across sessions/devices. The chip hides
// entirely once all four steps are done OR the user dismisses it.
function NavOnboarding() {
  const router = useRouter();
  const me = useQuery(api.users.me);
  const players = useQuery(api.players.listMine);
  const myElo = useQuery(api.leaderboard.mine);
  const mySeats = useQuery(api.rooms.mySeats);
  const dismiss = useMutation(api.users.dismissOnboarding);

  // hasKey lives in sessionStorage; we mirror it into state and refresh on
  // the custom event NavKey emits (same-tab writes skip the storage event).
  const [hasKey, setHasKey] = useState(false);
  const [mounted, setMounted] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- mount-time hydration from sessionStorage (client-only) */
  useEffect(() => {
    setMounted(true);
    setHasKey(!!readStoredKey());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    const refresh = () => setHasKey(!!readStoredKey());
    window.addEventListener(KEY_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(KEY_CHANGED_EVENT, refresh);
  }, []);

  // Wait for everything before deciding anything, to avoid flashing the chip
  // or showing a wrong count mid-load.
  const loading =
    !mounted ||
    me === undefined ||
    players === undefined ||
    myElo === undefined ||
    mySeats === undefined;

  const activeSeat =
    (mySeats ?? []).find((s) => s.seat.status !== "sitting_out") ?? null;
  const totalHands = (myElo ?? []).reduce((sum, r) => sum + r.gamesPlayed, 0);

  const steps: OnboardingStep[] = [
    {
      label: "Get set up to play",
      done: hasKey,
      cta: "Add your key",
      action: () => window.dispatchEvent(new Event(OPEN_KEY_EVENT)),
    },
    {
      label: "Create a player",
      done: (players ?? []).length > 0,
      cta: "New player",
      action: () => router.push("/roster?new"),
    },
    {
      label: "Sit at a table",
      done: activeSeat !== null,
      cta: "Browse rooms",
      action: () => router.push("/rooms"),
    },
    {
      label: "Play your first hand",
      done: totalHands > 0,
      cta: "Go to your table",
      action: () =>
        router.push(activeSeat ? `/rooms/${activeSeat.room._id}` : "/rooms"),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const dismissed = !!me?.onboardingDismissedAt;

  // Signed-out, still loading, complete, or dismissed → render nothing.
  if (loading || me === null || allDone || dismissed) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex h-[30px] items-center gap-2 rounded-full border border-primary/45 bg-primary/10 px-2.5 font-mono text-[11.5px] text-foreground transition-colors hover:bg-primary/15"
          aria-label="Onboarding progress"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-primary ring-[3px] ring-primary/20" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Setup
          </span>
          <span className="tabular-nums">
            {doneCount}/{steps.length}
          </span>
          <ChevronDown className="size-2.5 text-muted-foreground transition-transform group-aria-expanded:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-80">
        <PopoverHeader className="flex flex-row items-baseline justify-between gap-2">
          <PopoverTitle className="font-heading text-lg font-normal tracking-tight">
            Get <em className="not-italic text-foreground/60">playing</em>
          </PopoverTitle>
          <button
            type="button"
            onClick={() => void dismiss()}
            className="inline-flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground hover:text-foreground"
            aria-label="Dismiss onboarding"
          >
            <X className="size-3" />
            dismiss
          </button>
        </PopoverHeader>
        <ol className="flex flex-col gap-1">
          {steps.map((step, i) => (
            <li
              key={step.label}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5",
                step.done ? "text-muted-foreground" : "text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-mono tabular-nums",
                  step.done
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {step.done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className={cn("flex-1 text-[13px]", step.done && "line-through")}>
                {step.label}
              </span>
              {!step.done && (
                <Button variant="outline" size="xs" type="button" onClick={step.action}>
                  {step.cta}
                  <ArrowRight />
                </Button>
              )}
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}

function NavUser() {
  // Just the auth-scoped user row — small, cheap. We intentionally avoid
  // subscribing to `leaderboard.top` here just to surface best-ELO in the
  // chip; that's a 50-row reactive subscription on every page load.
  const me = useQuery(api.users.me);
  const initial = (me?.name || me?.email || "?").trim().charAt(0).toUpperCase();
  const display = me?.name || me?.email?.split("@")[0] || "guest";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1 text-[12.5px] transition-colors hover:bg-input/30"
        >
          <span
            className="grid size-6 place-items-center rounded-full border border-primary/30 font-heading text-xs text-primary"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, color-mix(in oklch, white 14%, transparent), transparent 60%), var(--felt)",
            }}
          >
            {initial}
          </span>
          <span>{display}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-56">
        <PopoverHeader>
          <PopoverTitle>{display}</PopoverTitle>
          {me?.email && (
            <PopoverDescription className="font-mono text-[11px]">
              {me.email}
            </PopoverDescription>
          )}
        </PopoverHeader>
        <div className="flex justify-end">
          <SignOutButton>
            <Button variant="outline" size="sm">Sign out</Button>
          </SignOutButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TopNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-15 max-w-[1400px] items-center gap-8 px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-3 font-heading text-xl tracking-tight"
        >
          <span
            className="grid size-7 place-items-center rounded-md border border-primary/30 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,white_5%,transparent)]"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, color-mix(in oklch, white 14%, transparent), transparent 60%), var(--felt)",
            }}
            aria-hidden="true"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.5c2.6 3.4 7.5 6.5 7.5 11a5.5 5.5 0 0 1-7 5.3l1 2.7H10.5l1-2.7a5.5 5.5 0 0 1-7-5.3C4.5 9 9.4 5.9 12 2.5Z" />
            </svg>
          </span>
          <span>
            Poker<em className="italic text-primary">LM</em>
          </span>
        </Link>

        <div className="hidden flex-1 items-center gap-6 text-[13.5px] md:flex">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative transition-colors hover:text-foreground",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {n.label}
                {active && (
                  <span className="absolute -bottom-1 left-0 right-0 h-px bg-primary" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <NavKey />
          <Show when="signed-in">
            <NavOnboarding />
            <NavUser />
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button variant="outline" size="sm">Sign in</Button>
            </SignInButton>
          </Show>
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter({ note }: { note?: string }) {
  return (
    <footer className="mx-auto mt-20 grid max-w-[1400px] grid-cols-[1fr_auto] items-center gap-4 border-t border-border px-10 py-7 pb-14 text-xs text-muted-foreground">
      <div className="flex items-center gap-4 font-mono text-[11px]">
        <span>POKERLM · v0.1</span>
        {note && (
          <>
            <span>·</span>
            <span>{note}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4 font-mono text-[11px]">
        <Link href="/how-it-works" className="hover:text-foreground">How it works</Link>
        <Link href="/leaderboard" className="hover:text-foreground">Leaderboard</Link>
        <Link href="/rooms" className="hover:text-foreground">Rooms</Link>
        <a
          href="https://github.com/Karnak19/pokerlm"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.02c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.04 11.04 0 0 1 5.8 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.55C20.21 21.38 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
          </svg>
          GitHub
        </a>
      </div>
    </footer>
  );
}

export function SiteShell({
  children,
  footerNote,
}: {
  children: React.ReactNode;
  footerNote?: string;
}) {
  return (
    <>
      <TopNav />
      {children}
      <SiteFooter note={footerNote} />
    </>
  );
}
