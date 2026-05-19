"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useMemo, useState } from "react";
import { CURATED_MODELS, DEFAULT_SYSTEM_PROMPT, type ModelOption } from "@/lib/models";
import { Id } from "../../../convex/_generated/dataModel";
import { Show, SignInButton } from "@clerk/nextjs";
import { ModelCombobox } from "@/components/model-combobox";
import { SiteShell } from "@/components/site-shell";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Plus, Upload, Search, Archive, Trash2, ArrowRight } from "lucide-react";

type OpenRouterModel = {
  id: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
};

const PROMPT_PRESETS: { label: string; prompt: string }[] = [
  { label: "Default · tight-aggressive", prompt: DEFAULT_SYSTEM_PROMPT },
  {
    label: "Maniac",
    prompt:
      "You are a maniac at the Texas Hold'em table. Open 90% of hands. Three-barrel any board where villain shows weakness. The pot is yours if you want it badly enough.",
  },
  {
    label: "Calling station",
    prompt:
      "Calling station with a spine. Float flops in position, peel turns with backdoor equity, hero-call the river when the runout misses.",
  },
  {
    label: "Nit",
    prompt:
      "Pocket pairs and big-card aces only. Limp under the gun, 3-bet from the cut-off and button. Never call a 4-bet without QQ+.",
  },
];

// Splits "Two Word Name" into ["Two Word", "Name"] so the last word can be italicized.
function splitLastWord(name: string): { head: string; tail: string } {
  const trimmed = name.trim();
  if (!trimmed) return { head: "", tail: "" };
  const idx = trimmed.lastIndexOf(" ");
  if (idx < 0) return { head: "", tail: trimmed };
  return { head: trimmed.slice(0, idx), tail: trimmed.slice(idx + 1) };
}

function fmtInt(n: number | null | undefined): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function joinedAt(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function PlayersPage() {
  const players = useQuery(api.players.listMine);
  const me = useQuery(api.users.me);
  const myElo = useQuery(api.leaderboard.mine);
  const create = useMutation(api.players.create);
  const update = useMutation(api.players.update);
  const remove = useMutation(api.players.remove);

  const eloByPlayer = useMemo(() => {
    const m = new Map<string, { rating: number; gamesPlayed: number; wins: number }>();
    for (const r of myElo ?? []) m.set(r.playerId, r);
    return m;
  }, [myElo]);

  const totals = useMemo(() => {
    if (!myElo || myElo.length === 0) return { peak: null, hands: 0 };
    let peak = -Infinity;
    let hands = 0;
    for (const r of myElo) {
      if (r.rating > peak) peak = r.rating;
      hands += r.gamesPlayed;
    }
    return { peak, hands };
  }, [myElo]);

  const [name, setName] = useState("");
  const [model, setModel] = useState(CURATED_MODELS[0].id);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [editingId, setEditingId] = useState<Id<"players"> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(CURATED_MODELS);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("https://openrouter.ai/api/v1/models")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { data: OpenRouterModel[] }) => {
        if (cancelled) return;
        const list: ModelOption[] = data.data
          .map((m) => ({ id: m.id, label: m.name ?? m.id }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setModels(list);
      })
      .catch(() => {
        /* keep curated fallback */
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setName("");
    setModel(CURATED_MODELS[0].id);
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setEditingId(null);
    setShowForm(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await update({ playerId: editingId, name, model, systemPrompt });
      } else {
        await create({ name, model, systemPrompt });
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(p: NonNullable<typeof players>[number]) {
    setEditingId(p._id);
    setName(p.name);
    setModel(p.model);
    setSystemPrompt(p.systemPrompt);
    setShowForm(true);
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function openNew() {
    resetForm();
    setShowForm(true);
    requestAnimationFrame(() => {
      document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const displayName = me?.name || me?.email?.split("@")[0] || "guest";
  const userInitial = (me?.name || me?.email || "?").trim().charAt(0).toUpperCase();
  const userEmail = me?.email || "—";

  const playerCount = players?.length ?? 0;
  const editingPlayer = useMemo(
    () => (editingId ? players?.find((p) => p._id === editingId) ?? null : null),
    [editingId, players],
  );

  const promptCharCount = systemPrompt.length;
  const promptLineCount = systemPrompt.split("\n").length;
  const promptTokenEst = Math.max(1, Math.round(promptCharCount / 4));
  const activePresetIdx = PROMPT_PRESETS.findIndex((p) => p.prompt === systemPrompt);

  return (
    <SiteShell footerNote={`${displayName} · ${playerCount} player${playerCount === 1 ? "" : "s"}`}>
      <main className="mx-auto w-full max-w-[1400px] px-10">
        {/* GREETING */}
        <header className="grid grid-cols-1 items-end gap-6 py-9 pb-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-3.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <Link href="/" className="hover:text-foreground">/</Link>
              <span className="text-muted-foreground/50">›</span>
              <span className="text-foreground">roster</span>
            </div>
            <h1 className="font-heading text-5xl font-normal leading-[0.98] tracking-tighter text-balance">
              Your <em className="italic text-foreground/60">roster</em>.
            </h1>
            <p className="mt-3.5 max-w-[62ch] text-[15.5px] leading-[1.55] text-muted-foreground">
              A player is a model and a prompt. Keep as many as you want — a nit, a maniac, one that
              only opens kings. Edits go live for the next hand they sit; live seats keep the prompt
              they sat down with.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-[56px_1fr] items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5 md:min-w-[280px]">
            <span className="pl-av size-14 text-[22px]">{userInitial}</span>
            <div className="grid gap-0.5">
              <span className="font-heading text-[22px] tracking-tight">
                {displayName} <em className="italic">m.</em>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {userEmail} · member since {joinedAt(me?._creationTime)}
              </span>
              <div className="mt-1 flex items-center gap-3 font-mono text-[11.5px] tabular-nums text-foreground">
                <span>
                  <span className="mr-1 text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">PEAK</span>
                  {fmtInt(totals.peak)} ELO
                </span>
                <span className="text-muted-foreground/50">·</span>
                <span>
                  <span className="mr-1 text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">HANDS</span>
                  {fmtInt(totals.hands)}
                </span>
                <span className="text-muted-foreground/50">·</span>
                <span>
                  <span className="mr-1 text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">RATED</span>
                  {fmtInt(myElo?.length ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </header>

        <Show when="signed-out">
          <div className="grid gap-3 rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-muted-foreground">Sign in to manage your players.</p>
            <div>
              <SignInButton mode="modal">
                <Button>Sign in</Button>
              </SignInButton>
            </div>
          </div>
        </Show>

        <Show when="signed-in">
          {/* STAT STRIP — only honest, derived numbers; no fake deltas */}
          <div className="my-2 mb-9 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            <StatCell label="Players · roster" value={fmtInt(playerCount)} />
            <StatCell label="Rated" value={fmtInt(myElo?.length ?? 0)} />
            <StatCell label="Hands · all-time" value={fmtInt(totals.hands)} />
          </div>

          {/* SECTION HEAD */}
          <div className="mb-4 mt-9 flex items-baseline justify-between gap-3.5">
            <h2 className="font-heading text-3xl font-normal tracking-tight">
              Your <em className="italic text-foreground/60">players</em>
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {playerCount} · sorted by last played
            </span>
          </div>

          {/* TOOLBAR */}
          <div className="flex flex-wrap items-center gap-2.5 pt-3.5 pb-5">
            <div className="relative min-w-[240px] max-w-[380px] flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" type="text" placeholder="Search by name, model, prompt…" />
            </div>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="archived">Archived</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs defaultValue="last">
              <TabsList>
                <TabsTrigger value="last">Last played</TabsTrigger>
                <TabsTrigger value="elo">ELO ↓</TabsTrigger>
                <TabsTrigger value="created">Created</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex-1" />
            <Button variant="outline" size="sm">
              <Upload />
              Import
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus />
              New player
              <span className="ml-1 rounded-sm border border-primary-foreground/20 px-1.5 py-px font-mono text-[10px]">N</span>
            </Button>
          </div>

          {/* PLAYER GRID */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
            {players === undefined && (
              <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground">Loading…</div>
            )}
            {players?.map((p) => {
              const initial = p.name.trim().charAt(0).toUpperCase() || "?";
              const isEditing = editingId === p._id;
              const elo = eloByPlayer.get(p._id);
              const winRate = elo && elo.gamesPlayed > 0 ? (elo.wins / elo.gamesPlayed) * 100 : null;
              const { head, tail } = splitLastWord(p.name);
              return (
                <article
                  key={p._id}
                  className={
                    "group relative grid gap-3.5 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-[0_16px_36px_-28px_color-mix(in_oklch,var(--primary)_35%,transparent)] " +
                    (isEditing
                      ? "border-chip/50 shadow-[0_0_0_1px_color-mix(in_oklch,var(--chip)_25%,transparent),0_16px_36px_-22px_color-mix(in_oklch,var(--chip)_30%,transparent)]"
                      : "border-border")
                  }
                >
                  <div className="grid grid-cols-[44px_1fr_auto] items-start gap-3">
                    <span
                      className="pl-av size-11 text-lg"
                      style={
                        isEditing
                          ? ({ ["--pl-av-color" as string]: "var(--chip)", color: "var(--chip)", borderColor: "color-mix(in oklch, var(--chip) 45%, transparent)" } as React.CSSProperties)
                          : undefined
                      }
                    >
                      {initial}
                    </span>
                    <div className="grid min-w-0 gap-0.5">
                      <h3 className="m-0 truncate font-heading text-[22px] font-normal leading-tight tracking-tight">
                        {head ? (
                          <>
                            {head} <em className="italic text-foreground/60">{tail}</em>
                          </>
                        ) : (
                          tail
                        )}
                      </h3>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">{p.model}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon-xs" aria-label="More">
                          <MoreVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => beginEdit(p)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem>Archive</DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Delete "${p.name}"?`)) void remove({ playerId: p._id });
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p
                    className="m-0 overflow-hidden rounded-r-lg border-l-2 border-primary/35 bg-input/20 px-3.5 py-3 font-heading text-sm italic leading-[1.5] text-foreground/85 before:text-primary before:content-['“'] after:text-primary after:content-['”']"
                    style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}
                  >
                    {p.systemPrompt}
                  </p>

                  <div className="grid grid-cols-3 gap-3 border-y border-dashed border-border py-3">
                    <StatCell
                      mini
                      label="ELO"
                      value={elo ? fmtInt(elo.rating) : "—"}
                      valueClass={elo ? "text-primary" : undefined}
                    />
                    <StatCell mini label="Hands" value={elo ? fmtInt(elo.gamesPlayed) : "—"} />
                    <StatCell
                      mini
                      label="Win %"
                      value={winRate !== null ? `${winRate.toFixed(1)}%` : "—"}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground">
                      {isEditing ? (
                        <>
                          <Badge variant="outline" className="border-chip/35 text-chip">
                            <span className="size-1.5 rounded-full bg-chip" />
                            editing
                          </Badge>
                          <span className="text-muted-foreground/50">·</span>
                          <span>unsaved</span>
                        </>
                      ) : elo ? (
                        <span>{fmtInt(elo.gamesPlayed)} hands played</span>
                      ) : (
                        <span>no hands played yet</span>
                      )}
                    </span>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="xs" type="button" onClick={() => beginEdit(p)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"?`)) void remove({ playerId: p._id });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* NEW PLAYER TILE */}
            <button
              type="button"
              onClick={openNew}
              className="grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-border bg-transparent p-5 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
            >
              <div className="grid justify-items-center gap-3.5">
                <span
                  className="grid size-14 place-items-center rounded-xl border border-primary/25 text-4xl leading-none text-primary"
                  style={{ background: "color-mix(in oklch, var(--input) 25%, transparent)", fontFamily: "var(--font-serif)" }}
                >
                  +
                </span>
                <span className="font-heading text-[22px] tracking-tight text-foreground">
                  Add a <em className="italic text-foreground/60">player</em>
                </span>
                <span className="max-w-[32ch] text-[13px] leading-[1.5]">
                  Pick a model. Write a prompt. Sit them at any open table in 60 seconds.
                </span>
                <span className="mt-1 rounded-md border border-border px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                  N · or click anywhere here
                </span>
              </div>
            </button>
          </div>

          {/* EDITOR */}
          {showForm && (
            <section
              id="editor"
              className="my-7 overflow-hidden rounded-3xl border border-chip/35 bg-card shadow-[inset_0_1px_0_color-mix(in_oklch,white_6%,transparent),0_0_0_1px_color-mix(in_oklch,var(--chip)_15%,transparent),0_30px_60px_-36px_color-mix(in_oklch,var(--chip)_30%,transparent)]"
            >
              <form onSubmit={onSubmit}>
                {/* head */}
                <div
                  className="flex items-center justify-between gap-4 border-b border-border px-6 py-4.5"
                  style={{
                    background:
                      "radial-gradient(60% 80% at 0% 50%, color-mix(in oklch, var(--chip) 8%, transparent), transparent 60%)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-chip/30 bg-chip/15 px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-chip">
                      {editingId ? "Editing" : "New player"}
                    </span>
                    <h2 className="m-0 font-heading text-2xl font-normal leading-none tracking-tight">
                      {name ? (
                        name
                      ) : (
                        <>
                          Untitled <em className="italic">player</em>
                        </>
                      )}
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-primary" />
                    {editingId ? "draft · unsaved" : "ready"}
                  </span>
                </div>

                {/* body */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  {/* form */}
                  <div className="grid gap-5 border-b border-border p-6 lg:border-b-0 lg:border-r">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor="player-name">Display name</Label>
                        <Input
                          id="player-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Shark du Bellagio"
                          maxLength={60}
                          required
                        />
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          Shown on the leaderboard and in hand history. 60 char max.
                        </span>
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Avatar initial</Label>
                        <Input
                          className="text-center font-mono"
                          value={name.trim().charAt(0).toUpperCase() || ""}
                          readOnly
                        />
                        <span className="font-mono text-[10.5px] text-muted-foreground">
                          Drawn from the first letter of the display name.
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label>Model</Label>
                      <ModelCombobox models={models} value={model} onChange={setModel} loading={modelsLoading} />
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {modelsLoading
                          ? "Loading models from OpenRouter…"
                          : `${models.length} OpenRouter models available. Cost is per Mtok on your key.`}
                      </span>
                    </div>

                    <div className="grid gap-2">
                      <Label>System prompt</Label>
                      <div className="flex flex-wrap gap-2">
                        {PROMPT_PRESETS.map((preset, idx) => {
                          const on = activePresetIdx === idx;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setSystemPrompt(preset.prompt)}
                              className={
                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors " +
                                (on
                                  ? "border-primary/55 bg-primary/12 text-foreground"
                                  : "border-border bg-input/20 text-foreground hover:bg-input/40")
                              }
                            >
                              <span className="font-heading text-[13px] italic text-foreground/60">★</span>
                              {preset.label}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-input/20 px-3 py-1.5 text-xs text-foreground hover:bg-input/40"
                        >
                          + Save current as preset
                        </button>
                      </div>

                      {/* IDE-style editor */}
                      <div className="overflow-hidden rounded-lg border border-input bg-input/30">
                        <div className="flex items-center justify-between border-b border-border bg-input/20 px-3.5 py-2.5">
                          <div className="flex items-center gap-2.5 font-mono text-[11px] text-muted-foreground">
                            <span className="size-[7px] rounded-full bg-chip" />
                            <span>prompt.txt</span>
                            <span className="text-muted-foreground/50">·</span>
                            <span>{editingId ? "unsaved" : "draft"}</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[10.5px] text-muted-foreground">
                            <span>{promptLineCount} lines</span>
                            <span>{promptCharCount.toLocaleString()} / 4,000 chars</span>
                            <span className="rounded-full border border-border px-1.5 py-0.5">≈ {promptTokenEst} tokens</span>
                          </div>
                        </div>
                        <Textarea
                          className="min-h-[220px] resize-y rounded-none border-0 bg-transparent px-4.5 py-4 font-mono text-[13px] leading-[1.7] focus-visible:ring-0"
                          spellCheck={false}
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          maxLength={4000}
                          required
                        />
                      </div>
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        Lives on your account · sent verbatim with every decision · max 4,000 chars.
                      </span>
                    </div>
                  </div>

                  {/* side */}
                  <aside
                    className="grid gap-5 p-6"
                    style={{
                      background:
                        "radial-gradient(70% 80% at 50% 0%, color-mix(in oklch, var(--primary) 6%, transparent), transparent 60%), var(--card)",
                    }}
                  >
                    <div className="grid gap-3.5 rounded-lg border border-border bg-background/40 px-4.5 py-4">
                      <div className="flex items-baseline justify-between">
                        <span className="font-heading text-lg tracking-tight">
                          Performance · <em className="italic text-foreground/60">last 30 days</em>
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {editingPlayer ? "0 hands" : "no data yet"}
                        </span>
                      </div>

                      <div className="grid gap-1.5">
                        <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3">
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">ELO</span>
                          <span className="font-mono text-[22px] tabular-nums text-foreground">1,500</span>
                          <span className="font-mono text-[11px] tabular-nums text-primary">+0</span>
                        </div>
                        <div className="relative h-14 overflow-hidden rounded-md border border-border bg-background/40">
                          <svg width="100%" height="56" viewBox="0 0 280 56" preserveAspectRatio="none" className="block">
                            <defs>
                              <linearGradient id="elo-fill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="oklch(0.76 0.135 145)" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="oklch(0.76 0.135 145)" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M0,38 L18,34 L34,40 L52,30 L68,32 L86,22 L102,26 L122,18 L140,24 L158,16 L176,20 L196,12 L214,18 L232,10 L252,14 L280,6 L280,56 L0,56 Z"
                              fill="url(#elo-fill)"
                            />
                            <path
                              d="M0,38 L18,34 L34,40 L52,30 L68,32 L86,22 L102,26 L122,18 L140,24 L158,16 L176,20 L196,12 L214,18 L232,10 L252,14 L280,6"
                              fill="none"
                              stroke="oklch(0.76 0.135 145)"
                              strokeWidth="1.5"
                            />
                            <circle cx="280" cy="6" r="3" fill="oklch(0.76 0.135 145)" />
                          </svg>
                        </div>
                        <div className="flex justify-between font-mono text-[9.5px] text-muted-foreground/70">
                          <span>30d ago · 1,500</span>
                          <span>15d</span>
                          <span>now · 1,500</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
                        <KvCell k="Peak ELO" v="1,500" em="· —" />
                        <KvCell k="Win rate" v="—" />
                        <KvCell k="VPIP / PFR" v="— / —" />
                        <KvCell k="Avg pot won" v="$0" vClass="text-chip" />
                        <KvCell k="All-ins · cooler" v="0 / 0" />
                        <KvCell k="Cost · 0 hands" v="$0.00" em="· spent" />
                      </div>
                    </div>

                    {editingId && editingPlayer && (
                      <div className="grid gap-2.5 rounded-lg border border-destructive/35 bg-destructive/5 px-4.5 py-3.5">
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-destructive">
                          Danger zone
                        </span>
                        <span className="font-mono text-[10.5px] text-destructive/70">
                          Archive keeps stats and hand history. Delete is permanent — ELO and history go with it.
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" type="button">
                            <Archive />
                            Archive
                          </Button>
                          <Button variant="outline" size="sm" type="button">
                            Duplicate
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => {
                              if (editingId && confirm(`Delete "${editingPlayer.name}"?`)) {
                                void remove({ playerId: editingId });
                                resetForm();
                              }
                            }}
                          >
                            <Trash2 />
                            Delete forever
                          </Button>
                        </div>
                      </div>
                    )}
                  </aside>
                </div>

                {/* foot */}
                <div className="flex items-center justify-between gap-4 border-t border-border bg-background/25 px-6 py-3.5">
                  <span className="font-mono text-[11.5px] text-muted-foreground">
                    {model} · {promptCharCount} chars · ≈ {promptTokenEst} toks per decision
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" type="button" onClick={resetForm}>
                      {editingId ? "Discard changes" : "Cancel"}
                    </Button>
                    <Button variant="outline" type="submit" disabled={submitting}>
                      {editingId ? "Save" : "Create"}
                      <ArrowRight />
                    </Button>
                  </div>
                </div>
              </form>
            </section>
          )}

        </Show>
      </main>
    </SiteShell>
  );
}

function StatCell({
  label,
  value,
  suffix,
  delta,
  deltaDown,
  valueClass,
  className,
  mini,
}: {
  label: string;
  value: string;
  suffix?: string;
  delta?: string;
  deltaDown?: boolean;
  valueClass?: string;
  className?: string;
  mini?: boolean;
}) {
  if (mini) {
    return (
      <div className={className}>
        <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className={"font-mono text-sm tabular-nums " + (valueClass ?? "text-foreground")}>{value}</div>
      </div>
    );
  }
  return (
    <div className={"relative grid gap-1 bg-card px-5 py-4 " + (className ?? "")}>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl leading-[1.05] tracking-tight">
        <span className={"font-mono text-[22px] tabular-nums " + (valueClass ?? "")}>{value}</span>
        {suffix && (
          <span className="ml-1.5 font-heading text-sm italic text-muted-foreground">{suffix}</span>
        )}
      </span>
      {delta && (
        <span
          className={
            "mt-0.5 font-mono text-[11px] tabular-nums " + (deltaDown ? "text-destructive" : "text-primary")
          }
        >
          {delta}
        </span>
      )}
    </div>
  );
}

function KvCell({ k, v, em, vClass }: { k: string; v: string; em?: string; vClass?: string }) {
  return (
    <div className="grid gap-1 bg-card px-3.5 py-3">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">{k}</span>
      <span className={"font-mono text-sm tabular-nums " + (vClass ?? "")}>
        {v}
        {em && <em className="font-heading text-[12.5px] not-italic text-muted-foreground italic"> {em}</em>}
      </span>
    </div>
  );
}

