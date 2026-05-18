"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useState } from "react";
import { CURATED_MODELS, DEFAULT_SYSTEM_PROMPT, type ModelOption } from "@/lib/models";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { ModelCombobox } from "@/components/model-combobox";

type OpenRouterModel = {
  id: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
};

export default function PlayersPage() {
  const players = useQuery(api.players.listMine);
  const create = useMutation(api.players.create);
  const update = useMutation(api.players.update);
  const remove = useMutation(api.players.remove);

  const [name, setName] = useState("");
  const [model, setModel] = useState(CURATED_MODELS[0].id);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [editingId, setEditingId] = useState<Id<"players"> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(CURATED_MODELS);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("https://openrouter.ai/api/v1/models")
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { data: OpenRouterModel[] }) => {
        if (cancelled) return;
        const list: ModelOption[] = data.data
          .map((m) => ({ id: m.id, label: m.name ?? m.id }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setModels(list);
      })
      .catch(() => { /* keep curated fallback */ })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function resetForm() {
    setName("");
    setModel(CURATED_MODELS[0].id);
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setEditingId(null);
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

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto p-8 space-y-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">← Home</Link>
        <h1 className="text-2xl font-semibold">My Players</h1>
        <div />
      </header>

      <Show when="signed-out">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-3">
          <p>Sign in to manage players.</p>
          <SignInButton mode="modal">
            <button className="px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium">
              Sign in
            </button>
          </SignInButton>
        </div>
      </Show>

      <Show when="signed-in">
        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="font-medium">{editingId ? "Edit player" : "New player"}</div>
          <input
            className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent"
            placeholder="Name (e.g. Shark du Bellagio)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
          />
          <div className="space-y-1">
            <ModelCombobox models={models} value={model} onChange={setModel} loading={modelsLoading} />
            <div className="text-xs text-zinc-500">
              {modelsLoading ? "Loading models from OpenRouter…" : `${models.length} models available`}
            </div>
          </div>
          <textarea
            className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent min-h-[120px] font-mono text-sm"
            placeholder="System prompt — define the strategy"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            maxLength={4000}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-medium disabled:opacity-50"
            >
              {editingId ? "Save" : "Create"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-sm">
                Cancel
              </button>
            )}
          </div>
        </form>

        <ul className="space-y-2">
          {players === undefined && <li className="text-sm text-zinc-500">Loading…</li>}
          {players && players.length === 0 && <li className="text-sm text-zinc-500">No players yet.</li>}
          {players?.map((p) => (
            <li key={p._id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-zinc-500 font-mono">{p.model}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">{p.systemPrompt}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700"
                  onClick={() => {
                    setEditingId(p._id);
                    setName(p.name);
                    setModel(p.model);
                    setSystemPrompt(p.systemPrompt);
                  }}
                >
                  Edit
                </button>
                <button
                  className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 dark:border-red-800"
                  onClick={() => {
                    if (confirm(`Delete "${p.name}"?`)) void remove({ playerId: p._id });
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Show>
    </main>
  );
}
