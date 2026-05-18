"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Show, SignInButton } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Privacy = "public" | "invite" | "private";

const STAKES_PRESETS = [
  { sb: 5, bb: 10, label: "micro" },
  { sb: 25, bb: 50, label: "low" },
  { sb: 50, bb: 100, label: "mid · 1 BB = 100" },
  { sb: 100, bb: 200, label: "high" },
];

const SEAT_RINGS: Record<number, React.CSSProperties[]> = {
  2: [
    { top: "50%", left: "8%", transform: "translateY(-50%)" },
    { top: "50%", right: "8%", transform: "translateY(-50%)" },
  ],
  3: [
    { top: "8%", left: "50%", transform: "translateX(-50%)" },
    { bottom: "12%", left: "14%" },
    { bottom: "12%", right: "14%" },
  ],
  4: [
    { top: "8%", left: "50%", transform: "translateX(-50%)" },
    { top: "50%", right: "8%", transform: "translateY(-50%)" },
    { bottom: "8%", left: "50%", transform: "translateX(-50%)" },
    { top: "50%", left: "8%", transform: "translateY(-50%)" },
  ],
  5: [
    { top: "8%", left: "50%", transform: "translateX(-50%)" },
    { top: "40%", right: "6%" },
    { bottom: "14%", right: "22%" },
    { bottom: "14%", left: "22%" },
    { top: "40%", left: "6%" },
  ],
  6: [
    { top: "6%", left: "50%", transform: "translateX(-50%)" },
    { top: "32%", right: "6%" },
    { bottom: "18%", right: "6%" },
    { bottom: "6%", left: "50%", transform: "translateX(-50%)" },
    { bottom: "18%", left: "6%" },
    { top: "32%", left: "6%" },
  ],
};

const SEAT_LABELS: Record<number, string> = {
  2: "heads-up",
  3: "short",
  4: "four-handed",
  5: "five seats",
  6: "full ring",
};

const PREVIEW_PIPS: Record<number, { top: string; left: string }[]> = {
  2: [
    { top: "50%", left: "8%" },
    { top: "50%", left: "92%" },
  ],
  3: [
    { top: "8%", left: "50%" },
    { top: "88%", left: "14%" },
    { top: "88%", left: "86%" },
  ],
  4: [
    { top: "8%", left: "50%" },
    { top: "50%", left: "92%" },
    { top: "92%", left: "50%" },
    { top: "50%", left: "8%" },
  ],
  5: [
    { top: "8%", left: "50%" },
    { top: "40%", left: "94%" },
    { top: "86%", left: "78%" },
    { top: "86%", left: "22%" },
    { top: "40%", left: "6%" },
  ],
  6: [
    { top: "8%", left: "50%" },
    { top: "32%", left: "92%" },
    { top: "78%", left: "92%" },
    { top: "92%", left: "50%" },
    { top: "78%", left: "8%" },
    { top: "32%", left: "8%" },
  ],
};

function fmtChips(n: number) {
  return n.toLocaleString("en-US");
}

function SectionHead({
  index,
  title,
  emTitle,
  note,
}: {
  index: string;
  title: string;
  emTitle?: string;
  note?: string;
}) {
  return (
    <CardHeader className="border-b border-dashed border-border pb-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="inline-flex items-baseline gap-2.5 font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
          <span className="text-[13px] text-primary">{index}</span>
          <span>{title}</span>
        </div>
        {note && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {note}
          </span>
        )}
      </div>
      {emTitle && (
        <h2 className="mt-2 font-heading text-[22px] font-normal leading-[1.1] tracking-tight">
          {emTitle}
        </h2>
      )}
    </CardHeader>
  );
}

export default function NewRoomPage() {
  const router = useRouter();
  const createRoom = useMutation(api.rooms.create);

  const [name, setName] = useState("Salon B");
  const [description, setDescription] = useState("");
  const [seats, setSeats] = useState(6);
  const [presetIdx, setPresetIdx] = useState<number | null>(2);
  const [smallBlind, setSmallBlind] = useState(50);
  const [bigBlind, setBigBlind] = useState(100);
  const [currency, setCurrency] = useState<"chips" | "bb">("chips");
  const [stackBB, setStackBB] = useState(100);
  const [privacy, setPrivacy] = useState<Privacy>("public");
  const [autoDeal, setAutoDeal] = useState(true);
  const [showThinking, setShowThinking] = useState(true);
  const [timeBank, setTimeBank] = useState(true);
  const [ranked, setRanked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startingStackChips = stackBB * bigBlind;

  function pickPreset(i: number) {
    setPresetIdx(i);
    setSmallBlind(STAKES_PRESETS[i].sb);
    setBigBlind(STAKES_PRESETS[i].bb);
  }
  function manualBlind(which: "sb" | "bb", v: number) {
    setPresetIdx(null);
    if (which === "sb") setSmallBlind(v);
    else setBigBlind(v);
  }

  const summaryStr = useMemo(
    () =>
      `${seats} seats · ${smallBlind}/${bigBlind} · ${stackBB} BB starting · ${privacy} · auto-deal ${autoDeal ? "on" : "off"}`,
    [seats, smallBlind, bigBlind, stackBB, privacy, autoDeal],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const id = await createRoom({
        name: name.trim() || "Room",
        maxSeats: seats,
        smallBlind,
        bigBlind,
        startingStack: startingStackChips,
      });
      if (id) router.push(`/rooms/${id}`);
      else router.push("/rooms");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed to create room");
      setBusy(false);
    }
  }

  const initial = "M";
  const displayName = name.trim() || "Untitled";
  const nameParts = displayName.split(" ");
  const nameHead =
    nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : displayName;
  const nameTail =
    nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

  const seatPips = PREVIEW_PIPS[seats];

  return (
    <SiteShell footerNote="room draft · unsaved">
      <main className="mx-auto w-full max-w-[1400px] px-10">
        {/* Page head */}
        <header className="flex items-end justify-between gap-6 pb-5 pt-8">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">/</Link>
              <span>›</span>
              <Link href="/rooms" className="hover:text-foreground">rooms</Link>
              <span>›</span>
              <span className="text-foreground">new</span>
            </div>
            <h1 className="mt-2 font-heading text-[42px] font-normal leading-[1.05] tracking-tight">
              Build a <em className="italic text-primary">table</em>.
            </h1>
            <p className="mt-3 max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
              Name the room, set the stakes, decide who gets the door. Two to
              six seats. Blinds rotate left of the button every hand. Buy-in
              equals the starting stack — once you sit, the chips are yours
              until you fold or leave.
            </p>
          </div>
          <div className="shrink-0">
            <Button asChild variant="ghost">
              <Link href="/rooms">← Back to rooms</Link>
            </Button>
          </div>
        </header>

        <Show when="signed-out">
          <Card className="my-6 mb-16 p-6 text-center">
            <CardContent className="grid gap-2">
              <h2 className="font-heading text-[22px] font-normal">
                Sign in to{" "}
                <em className="italic text-primary">build a table</em>.
              </h2>
              <p className="text-sm text-muted-foreground">
                Rooms are tied to your account. One free OpenRouter key is all
                you need.
              </p>
              <div className="mt-2 flex justify-center">
                <SignInButton mode="modal">
                  <Button size="lg">Sign in</Button>
                </SignInButton>
              </div>
            </CardContent>
          </Card>
        </Show>

        <Show when="signed-in">
          <form
            onSubmit={onSubmit}
            className="grid grid-cols-1 items-start gap-12 pb-16 pt-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
          >
            <div className="grid gap-3.5">
              {/* 01 · Identity */}
              <Card className="px-6 py-6">
                <SectionHead index="01" title="Identity" note="required" />
                <CardContent className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="room-name" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Room name
                      </Label>
                      <Input
                        id="room-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Friday night grind"
                        maxLength={60}
                      />
                      <span className="text-[12px] text-muted-foreground">
                        Shown on the lobby · 60 char max.
                      </span>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="room-desc" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Description
                        <span className="ml-1 normal-case tracking-normal">
                          — optional
                        </span>
                      </Label>
                      <Input
                        id="room-desc"
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="A nightcap, slow blinds, no tilt."
                      />
                      <span className="text-[12px] text-muted-foreground">
                        One sentence under the title.
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 02 · Seats */}
              <Card className="px-6 py-6">
                <SectionHead index="02" title="Seats" note="2 to 6" />
                <CardContent>
                  <Tabs
                    value={String(seats)}
                    onValueChange={(v) => setSeats(Number(v))}
                  >
                    <TabsList className="grid h-auto w-full grid-cols-5 gap-2 bg-transparent p-0">
                      {[2, 3, 4, 5, 6].map((n) => {
                        const active = seats === n;
                        return (
                          <TabsTrigger
                            key={n}
                            value={String(n)}
                            className={cn(
                              "flex h-auto flex-col items-center gap-2.5 rounded-[10px] border px-3 py-4 transition-colors",
                              active
                                ? "border-primary/55 bg-primary/10 text-foreground data-[state=active]:bg-primary/10 data-[state=active]:shadow-none"
                                : "border-border bg-input/20 text-foreground hover:bg-input/40 data-[state=active]:bg-primary/10",
                            )}
                          >
                            <span
                              className={cn(
                                "relative size-[38px] rounded-full border",
                                active
                                  ? "border-solid border-primary/60"
                                  : "border-dashed border-primary/35",
                              )}
                            >
                              {SEAT_RINGS[n].map((style, i) => (
                                <i
                                  key={i}
                                  className="absolute size-[5px] rounded-full bg-primary/80"
                                  style={style}
                                />
                              ))}
                            </span>
                            <span className="font-mono text-[13px] tabular-nums">
                              {n}
                            </span>
                            <span className="font-heading text-[12px] italic text-muted-foreground">
                              {SEAT_LABELS[n]}
                            </span>
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </Tabs>
                </CardContent>
              </Card>

              {/* 03 · Stakes */}
              <Card className="px-6 py-6">
                <SectionHead
                  index="03"
                  title="Stakes & stack"
                  note="small / big · chips"
                />
                <CardContent className="grid gap-5">
                  <div>
                    <div className="mb-2.5 flex items-baseline justify-between">
                      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Blinds preset
                      </span>
                      <span className="text-[12px] text-muted-foreground">
                        Tap a preset or set custom below.
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {STAKES_PRESETS.map((p, i) => {
                        const active = presetIdx === i;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => pickPreset(i)}
                            className={cn(
                              "grid gap-[3px] rounded-[9px] border p-3 text-left transition-colors",
                              active
                                ? "border-primary/55 bg-primary/10"
                                : "border-border bg-input/20 hover:bg-input/40",
                            )}
                          >
                            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
                              SB / BB
                            </span>
                            <span className="font-mono text-[14px] tabular-nums text-foreground">
                              {p.sb} / {p.bb}
                            </span>
                            <span className="font-heading text-[13px] italic text-muted-foreground">
                              {p.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3.5 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="sb" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Small blind
                      </Label>
                      <Input
                        id="sb"
                        type="text"
                        inputMode="numeric"
                        className="font-mono tabular-nums"
                        value={smallBlind}
                        onChange={(e) =>
                          manualBlind(
                            "sb",
                            Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="bb" className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Big blind
                      </Label>
                      <Input
                        id="bb"
                        type="text"
                        inputMode="numeric"
                        className="font-mono tabular-nums"
                        value={bigBlind}
                        onChange={(e) =>
                          manualBlind(
                            "bb",
                            Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Currency
                      </Label>
                      <Tabs
                        value={currency}
                        onValueChange={(v) =>
                          setCurrency(v as "chips" | "bb")
                        }
                      >
                        <TabsList className="grid h-8 w-full grid-cols-2">
                          <TabsTrigger value="chips">Chips</TabsTrigger>
                          <TabsTrigger value="bb">BB</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      Starting stack ·{" "}
                      <span className="font-mono text-[12px] tabular-nums normal-case tracking-normal text-foreground">
                        {stackBB} BB
                      </span>
                    </Label>
                    <div className="grid grid-cols-[1fr_110px] items-center gap-4">
                      <div>
                        <input
                          type="range"
                          min={20}
                          max={500}
                          step={10}
                          value={stackBB}
                          onChange={(e) => setStackBB(Number(e.target.value))}
                          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-input/30 outline-none [&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:size-[18px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_20%,transparent)]"
                        />
                        <div className="mt-2 flex justify-between font-mono text-[10.5px] text-muted-foreground">
                          <span>20 BB</span>
                          <span>50</span>
                          <span>100</span>
                          <span>200</span>
                          <span>500 BB</span>
                        </div>
                      </div>
                      <Input
                        type="text"
                        className="text-right font-mono tabular-nums"
                        value={fmtChips(startingStackChips)}
                        onChange={(e) => {
                          const n =
                            Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                          if (bigBlind > 0)
                            setStackBB(Math.max(1, Math.round(n / bigBlind)));
                        }}
                      />
                    </div>
                    <span className="text-[12px] text-muted-foreground">
                      In chips. 100 BB is the standard deep-stack buy-in.
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* 04 · Privacy */}
              <Card className="px-6 py-6">
                <SectionHead index="04" title="Who gets in" note="privacy" />
                <CardContent>
                  <RadioGroup
                    value={privacy}
                    onValueChange={(v) => setPrivacy(v as Privacy)}
                    className="grid gap-2.5"
                  >
                    {(
                      [
                        {
                          v: "public",
                          t: "Public",
                          em: "list it on the lobby",
                          d: "Anyone signed in can sit. Spectators welcome.",
                          meta: "default",
                          metaMono: false,
                        },
                        {
                          v: "invite",
                          t: "Invite-only",
                          em: "share a link",
                          d: "Hidden from the lobby. Only people with the URL can join.",
                          meta: "/r/abc-def-123",
                          metaMono: true,
                        },
                        {
                          v: "private",
                          t: "Private to me",
                          em: "solo sandbox",
                          d: "Bring multiple players from your roster. No one else can sit.",
                          meta: "sandbox",
                          metaMono: false,
                        },
                      ] as const
                    ).map((opt) => {
                      const active = privacy === opt.v;
                      return (
                        <Label
                          key={opt.v}
                          htmlFor={`privacy-${opt.v}`}
                          className={cn(
                            "grid cursor-pointer grid-cols-[auto_1fr_auto] items-start gap-3.5 rounded-[10px] border px-4 py-3.5 transition-colors",
                            active
                              ? "border-primary/55 bg-primary/10"
                              : "border-border bg-input/[0.18] hover:bg-input/30",
                          )}
                        >
                          <RadioGroupItem
                            value={opt.v}
                            id={`privacy-${opt.v}`}
                            className="mt-0.5"
                          />
                          <div className="grid gap-1">
                            <span className="text-[14px] font-medium">
                              {opt.t} —{" "}
                              <em className="font-heading font-normal italic text-foreground/60">
                                {opt.em}
                              </em>
                            </span>
                            <span className="text-[12.5px] font-normal text-muted-foreground">
                              {opt.d}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "self-start text-[11px] text-muted-foreground",
                              opt.metaMono && "font-mono",
                            )}
                          >
                            {opt.meta}
                          </span>
                        </Label>
                      );
                    })}
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* 05 · House rules */}
              <Card className="px-6 py-6">
                <SectionHead index="05" title="House rules" note="optional" />
                <CardContent className="grid gap-0">
                  {(
                    [
                      {
                        key: "autoDeal",
                        t: "Auto-deal next hand",
                        d: "When a hand ends, deal the next one after a 4s pause.",
                        v: autoDeal,
                        set: setAutoDeal,
                      },
                      {
                        key: "showThinking",
                        t: "Show thinking log to spectators",
                        d: "Models' reasoning is visible in real time. Off keeps it cleaner.",
                        v: showThinking,
                        set: setShowThinking,
                      },
                      {
                        key: "timeBank",
                        t: "Time bank · 12s per decision",
                        d: "Slow models forfeit to a default check / fold past this.",
                        v: timeBank,
                        set: setTimeBank,
                      },
                      {
                        key: "ranked",
                        t: "Affect ranked ELO",
                        d: "Off means hands here don't change leaderboard standing.",
                        v: ranked,
                        set: setRanked,
                      },
                    ] as const
                  ).map((row, i) => (
                    <div
                      key={row.key}
                      className={cn(
                        "grid grid-cols-[1fr_auto] items-center gap-3.5 px-4 py-3",
                        i > 0 && "border-t border-dashed border-border",
                      )}
                    >
                      <div className="grid gap-0.5">
                        <Label
                          htmlFor={`rule-${row.key}`}
                          className="text-[14px] font-normal"
                        >
                          {row.t}
                        </Label>
                        <span className="text-[12px] text-muted-foreground">
                          {row.d}
                        </span>
                      </div>
                      <Switch
                        id={`rule-${row.key}`}
                        checked={row.v}
                        onCheckedChange={row.set}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Submit */}
              <Card
                className="px-5 py-4"
                style={{
                  background:
                    "radial-gradient(70% 80% at 0% 50%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 60%), var(--card)",
                  borderColor: "color-mix(in oklch, var(--primary) 35%, transparent)",
                }}
              >
                <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="grid gap-1">
                    <div className="font-heading text-[20px] tracking-tight">
                      Ready to{" "}
                      <em className="italic text-foreground/60">cut the deck</em>.
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {summaryStr}
                    </div>
                    {err && (
                      <div className="font-mono text-[11px] text-destructive">
                        {err}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      disabled={busy}
                    >
                      Save as template
                    </Button>
                    <Button type="submit" size="lg" disabled={busy}>
                      {busy ? "Creating…" : "Create room"}
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
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Preview */}
            <aside className="sticky top-21 grid gap-3.5">
              <div className="pl-felt relative overflow-hidden rounded-[1.4rem] px-6 pb-5 pt-6 shadow-[0_30px_80px_-40px_color-mix(in_oklch,var(--primary)_35%,transparent),0_18px_32px_-20px_color-mix(in_oklch,black_70%,transparent)]">
                <div className="mb-4 flex items-center justify-between font-mono text-[10.5px] tracking-wide text-white/55">
                  <span>PREVIEW · LIVE</span>
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-white/[0.06] text-[10.5px] text-white/90"
                  >
                    waiting for seats
                  </Badge>
                </div>

                <div className="mb-1 mt-1 font-heading text-[36px] font-normal leading-[1.02] tracking-tight text-white/95">
                  {nameTail ? (
                    <>
                      {nameHead} <em className="italic text-primary">{nameTail}</em>
                    </>
                  ) : (
                    <em className="italic text-primary">{nameHead}</em>
                  )}
                </div>
                <div className="font-mono text-[11px] text-white/55">
                  room · pending · hosted by you · {smallBlind} / {bigBlind}
                </div>

                {/* Felt table mock */}
                <div className="pl-felt relative mx-auto my-5 h-[200px] w-[280px] rounded-[140px] shadow-[inset_0_0_0_6px_color-mix(in_oklch,var(--felt)_80%,black),inset_0_0_0_7px_color-mix(in_oklch,var(--primary)_25%,transparent),inset_0_0_50px_color-mix(in_oklch,black_50%,transparent)]">
                  {seatPips.map((pos, i) => {
                    const isYou = i === 0;
                    return (
                      <span
                        key={i}
                        className={cn(
                          "absolute grid size-[26px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-mono text-[10px]",
                          isYou
                            ? "pl-av border border-primary/80 text-primary-foreground"
                            : "border border-dashed border-primary/35 bg-background/70 text-white/55",
                        )}
                        style={
                          isYou
                            ? { ...pos, background: "var(--primary)" }
                            : pos
                        }
                      >
                        {isYou ? initial : i + 1}
                      </span>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-white/10 bg-white/10">
                  {(
                    [
                      {
                        k: "Seats",
                        v: (
                          <>
                            {seats}{" "}
                            <em className="font-heading text-[13px] italic text-white/70">
                              {SEAT_LABELS[seats]}
                            </em>
                          </>
                        ),
                      },
                      { k: "Stakes", v: <>{smallBlind} / {bigBlind}</> },
                      {
                        k: "Starting stack",
                        v: (
                          <>
                            {fmtChips(startingStackChips)}{" "}
                            <em className="font-heading text-[13px] italic text-white/70">
                              {stackBB} BB
                            </em>
                          </>
                        ),
                      },
                      {
                        k: "Time bank",
                        v: (
                          <>
                            {timeBank ? "12s" : "off"}{" "}
                            <em className="font-heading text-[13px] italic text-white/70">
                              per decision
                            </em>
                          </>
                        ),
                      },
                      {
                        k: "Privacy",
                        v: (
                          <em className="font-heading text-[13px] italic text-white/70">
                            {privacy === "private"
                              ? "private"
                              : privacy === "invite"
                                ? "invite-only"
                                : "public"}
                          </em>
                        ),
                      },
                      {
                        k: "Ranked",
                        v: (
                          <em className="font-heading text-[13px] italic text-white/70">
                            {ranked ? "ranked · ELO" : "casual · no ELO"}
                          </em>
                        ),
                      },
                    ] as const
                  ).map((cell, i) => (
                    <div
                      key={i}
                      className="grid gap-1 bg-background/50 px-3.5 py-3"
                    >
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/55">
                        {cell.k}
                      </span>
                      <span className="font-mono text-[16px] tabular-nums text-white/95">
                        {cell.v}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost card */}
              <Card className="px-6 py-5">
                <CardHeader className="gap-0.5 p-0">
                  <div className="font-heading text-[18px] tracking-tight">
                    Cost{" "}
                    <em className="italic text-foreground/60">napkin math</em>
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">
                    Estimate per 100 hands · your OpenRouter key, your bill.
                  </div>
                </CardHeader>
                <Separator className="border-dashed" />
                <CardContent className="grid gap-2.5 p-0">
                  {(
                    [
                      {
                        nm: "claude-3.5-sonnet",
                        mtok: "$3 / Mtok",
                        pot: "$0.42 / hand",
                      },
                      { nm: "gpt-4o", mtok: "$2.5 / Mtok", pot: "$0.36 / hand" },
                      {
                        nm: "deepseek-r1",
                        mtok: "$0.55 / Mtok",
                        pot: "$0.08 / hand",
                      },
                      {
                        nm: "gpt-4o-mini · ×3",
                        mtok: "$0.15 / Mtok",
                        pot: "$0.06 / hand",
                      },
                    ] as const
                  ).map((ln, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3"
                    >
                      <span className="font-mono text-[12px]">{ln.nm}</span>
                      <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                        {ln.mtok}
                      </span>
                      <span className="font-mono text-[12.5px] tabular-nums">
                        {ln.pot}
                      </span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="grid grid-cols-[1fr_auto] border-t border-border pt-3.5">
                  <span className="self-end font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    ≈ 100 hands · all seats
                  </span>
                  <span className="font-mono text-[22px] tabular-nums text-chip">
                    $92.00
                  </span>
                </CardFooter>
              </Card>
            </aside>
          </form>
        </Show>
      </main>
    </SiteShell>
  );
}
