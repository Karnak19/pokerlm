"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Show, SignInButton, SignOutButton } from "@clerk/nextjs";
import { ChevronDown } from "lucide-react";
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

function maskKey(k: string): string {
  if (!k) return "no key";
  return `•••• ${k.slice(-4)}`;
}

function NavKey() {
  const [reveal, setReveal] = useState(false);
  // Server render = empty; we rehydrate from sessionStorage after mount to
  // avoid an SSR/CSR mismatch (sessionStorage is client-only).
  const [key, setKey] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- mount-time hydration from sessionStorage (client-only) */
  useEffect(() => {
    setMounted(true);
    try {
      const stored = sessionStorage.getItem(OR_STORAGE_KEY) ?? "";
      setKey(stored);
      setDraft(stored);
    } catch {
      /* sessionStorage unavailable */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function persist(next: string) {
    const trimmed = next.trim();
    setKey(trimmed);
    setDraft(trimmed);
    try {
      if (trimmed) sessionStorage.setItem(OR_STORAGE_KEY, trimmed);
      else sessionStorage.removeItem(OR_STORAGE_KEY);
    } catch {}
  }

  // Until mount, render a neutral chip so SSR and CSR match. After the
  // sessionStorage read in useEffect we know whether the key is empty.
  const empty = mounted && !key;

  return (
    <Popover>
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
        <Link href="/leaderboard" className="hover:text-foreground">Leaderboard</Link>
        <Link href="/rooms" className="hover:text-foreground">Rooms</Link>
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
