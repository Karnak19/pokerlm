import { cacheLife } from "next/cache";
import { ArrowRight, Check, Key, Lock, Shield, StickyNote } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "How PokerLM works",
  description:
    "Bring your own OpenRouter key, play hands of Texas Hold'em against language models, and watch ELO move. Your key never leaves your browser.",
};

const SHELL = "mx-auto w-full max-w-[760px] px-6";

function Section({
  anchor,
  title,
  lede,
  children,
}: {
  anchor: string;
  title: string;
  lede?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className={`${SHELL} pt-12`} id={anchor}>
      <h2 className="font-heading text-2xl font-normal leading-tight tracking-tight md:text-[28px]">
        {title}
      </h2>
      {lede && (
        <p className="mt-3 max-w-[64ch] text-[15.5px] leading-[1.6] text-muted-foreground">
          {lede}
        </p>
      )}
      {children && <div className="mt-5 grid gap-4">{children}</div>}
    </section>
  );
}

export default async function HowItWorksPage() {
  "use cache";
  cacheLife("hours");
  return (
    <SiteShell>
      <main className="pb-24">
        {/* ─── HERO ─── */}
        <header className={`${SHELL} pt-20 pb-2`}>
          <h1 className="font-heading text-[clamp(34px,4.5vw,56px)] font-normal leading-[1.02] tracking-[-0.018em]">
            How PokerLM works
          </h1>
          <p className="mt-5 max-w-[64ch] text-[15.5px] leading-[1.6] text-foreground/80">
            PokerLM is BYO-key. Your OpenRouter key stays in your browser session,
            calls fan out to whichever models your players use, and we write
            virtual chips + ELO to our database. We don&apos;t see your bill, and
            we can&apos;t spend on your behalf.
          </p>
        </header>

        <Section
          anchor="your-key"
          title="Your key"
          lede={
            <>
              We use OpenRouter as the gateway to every model. When you paste a
              key into the nav chip, it lands in <span className="font-mono text-foreground">sessionStorage</span>{" "}
              — bound to this tab, on this device. The key never goes to our
              Convex database and is never written to disk on our side.
            </>
          }
        >
          <ul className="grid gap-3 text-[15px] leading-[1.55] text-foreground/85">
            {[
              <>
                <strong className="text-foreground">Closing the tab clears it.</strong>{" "}
                sessionStorage is scoped to the browser tab. Sign-in does not
                persist your key across tabs or browsers.
              </>,
              <>
                <strong className="text-foreground">Each tab makes the OpenRouter call.</strong>{" "}
                When your seat is to act, the page sends the key along with the
                hand context to a Convex action which proxies the request to{" "}
                <span className="font-mono text-foreground">openrouter.ai</span>.
                The key is used in transit; we don&apos;t log it.
              </>,
              <>
                <strong className="text-foreground">We can&apos;t spend without you watching.</strong>{" "}
                A hand only consumes tokens while the tab is open and your seat
                is to act. Close the tab and nothing else runs on your dime.
              </>,
            ].map((line, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          anchor="openrouter-only"
          title="OpenRouter only"
          lede={
            <>
              We could let you paste an Anthropic, OpenAI, or Google key directly.
              We don&apos;t — and we never will. OpenRouter is the only provider
              we support because it&apos;s the only one with{" "}
              <span className="text-foreground">first-class throwaway keys with
              hard spend caps</span>.
            </>
          }
        >
          <div className="grid gap-3 text-[15px] leading-[1.55] text-foreground/85">
            <p>
              The point is to bound the worst case. If a bug ever leaks your key
              (ours, OpenRouter&apos;s, your browser extension&apos;s, a rogue
              dependency), the blast radius is whatever cap you set when you
              minted the key — not your entire AI provider account.
            </p>
            <p>
              With raw provider keys we&apos;d be one bad day away from someone
              draining a $5,000 bill. Routing through OpenRouter pushes that
              risk onto a fence we can&apos;t cross. We&apos;d rather lose the
              flexibility of native keys than ever read about a PokerLM-shaped
              shit storm on Hacker News.
            </p>
            <p>
              If OpenRouter doesn&apos;t carry a model you want, file an issue
              and we&apos;ll vote with you for them to add it before we&apos;d
              add a second backend.
            </p>
          </div>
        </Section>

        <Section
          anchor="throwaway-keys"
          title="Throwaway keys"
          lede={
            <>
              You should never paste a long-lived production key into a tab you
              don&apos;t fully trust — including ours. OpenRouter lets you mint
              short-lived keys with hard spend limits in 30 seconds. Our
              recommendation: <span className="text-foreground">$1 cap, 1-hour
              expiry</span>. Plenty for an evening of cheap-tier hands; if the
              key leaks the worst case is a dollar and it&apos;s dead within
              the hour anyway.
            </>
          }
        >
          <ol className="grid gap-3 text-[15px] leading-[1.55] text-foreground/85">
            {[
              "Open OpenRouter → Settings → Keys.",
              "Create a new key. Set a name like “pokerlm-2026-05”.",
              "Set a $1 hard credit limit and a 1-hour expiry. Save the key.",
              "Paste it into the KEY chip in the navbar, top right.",
              "Mint a fresh key next time you play. No rotation needed — old keys self-expire.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 font-mono text-[11px] text-primary">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3">
            <Button asChild variant="outline">
              <a
                href="https://openrouter.ai/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Key />
                Open OpenRouter keys
                <ArrowRight />
              </a>
            </Button>
          </div>
        </Section>

        <Section
          anchor="what-we-store"
          title="What we store"
          lede="Anything tied to gameplay history is in our database. Your key, your prompts, and your spend are not."
        >
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
            <div className="grid gap-3 bg-card p-6">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                <Check className="size-3.5" />
                Stored in Convex
              </div>
              <ul className="grid gap-2 text-[14.5px] text-foreground/85">
                <li>· Your email + display name (via Clerk)</li>
                <li>· Your players (name, model id, system prompt)</li>
                <li>· Rooms you created and seats you took</li>
                <li>· Every action of every hand you played</li>
                <li>· Per-player ELO rating + history snapshots</li>
                <li>· Per-seat session notes (cleared when you leave the room)</li>
              </ul>
            </div>
            <div className="grid gap-3 bg-card p-6">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-destructive">
                <Shield className="size-3.5" />
                Never stored
              </div>
              <ul className="grid gap-2 text-[14.5px] text-foreground/85">
                <li>· Your OpenRouter API key</li>
                <li>· Your OpenRouter spend or invoice</li>
                <li>· Conversation logs beyond the hand action that resulted</li>
                <li>· Any payment info — we don&apos;t take any</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          anchor="bots-take-notes"
          title="Bots take notes"
          lede={
            <>
              At the end of every hand, each of your seated players gets a chance
              to update a short freeform note about the table. They use those
              notes on every future hand at the same table — so they pick up on
              who bluffs, who only c-bets the flop, who shows down trash. It&apos;s
              the same thing a real grinder does with a notepad next to the
              laptop.
            </>
          }
        >
          <ul className="grid gap-3 text-[15px] leading-[1.55] text-foreground/85">
            {[
              <>
                <strong className="text-foreground">One note per seat.</strong>{" "}
                Scoped to <em className="italic text-foreground/70">this seating at this table</em>.
                Leave the room and the note is wiped. Sit again — fresh slate.
                Cross-table memory is intentionally not a thing.
              </>,
              <>
                <strong className="text-foreground">The bot decides whether to update.</strong>{" "}
                After each completed hand we hand the model an{" "}
                <span className="font-mono text-foreground">update_memory</span>{" "}
                tool and the full hand transcript. If it has nothing new to say,
                it doesn&apos;t call. If it does, the new text fully replaces the
                old (≤1000 chars).
              </>,
              <>
                <strong className="text-foreground">You can peek.</strong>{" "}
                On the felt, every seat you own has a small sticky-note icon —
                click to see exactly what your bot is thinking about the table.
                Read-only; the bot edits its own notes.
              </>,
              <>
                <strong className="text-foreground">Only fires while you&apos;re watching.</strong>{" "}
                Same constraint as the gameplay calls — your tab is what pays.
                Close the room and no reflects run. The next hand auto-deals 15
                seconds after the last one finishes, which is the window the
                reflect call has to land.
              </>,
            ].map((line, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <StickyNote className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          anchor="cost"
          title="Cost per hand"
          lede={
            <>
              The expensive part of a hand is reading the table state and producing
              a decision. Smaller, cheaper models do this fine — and the prompt
              matters more than the parameter count. Here&apos;s a rough sense of
              what you&apos;ll pay per 1,000 hands, assuming ~700 prompt tokens
              and ~150 completion tokens per turn × 3 turns per hand.
            </>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-4 border-b border-border bg-background/30 px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Tier · example model</span>
              <span>per Mtok</span>
              <span>~1,000 hands</span>
            </div>
            {[
              { tier: "Cheap", model: "deepseek/deepseek-v4-flash", mtok: "$0.11 in · $0.22 out", per1k: "~$0.34", tone: "text-primary" },
              { tier: "Mid", model: "google/gemini-3-flash", mtok: "$0.50 in · $3 out", per1k: "~$2.40", tone: "text-foreground" },
              { tier: "Flagship", model: "anthropic/claude-opus-4.7", mtok: "$5 in · $25 out", per1k: "~$22", tone: "text-chip" },
            ].map((r) => (
              <div
                key={r.tier}
                className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0"
              >
                <div className="grid gap-0.5">
                  <span className={`text-sm ${r.tone}`}>{r.tier}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{r.model}</span>
                </div>
                <span className="font-mono tabular-nums text-sm text-muted-foreground">
                  {r.mtok}
                </span>
                <span className="font-mono tabular-nums text-sm">{r.per1k}</span>
              </div>
            ))}
          </div>
          <p className="text-[13.5px] leading-[1.55] text-muted-foreground">
            These are rough back-of-envelope numbers — actual spend depends on
            prompt length, model verbosity, and how many of your seats sit in
            big multi-way pots. The KEY chip is the only place this happens;
            we never see the invoice.
          </p>
          <p className="text-[13.5px] leading-[1.55] text-muted-foreground">
            Heads up: at the end of every completed hand, each of your seated
            players runs an extra short LLM call to update its private notes
            about the table — but only while you&apos;re actually watching the
            room. Six players you own, all watching, means six extra calls
            per hand. If the tab is closed, no reflect fires.
          </p>
        </Section>

        <Section
          anchor="hand-flow"
          title="Hand flow"
          lede="When it's your seat's turn, here's what happens on the wire."
        >
          <ol className="grid gap-3">
            {[
              {
                t: "Your browser",
                d: <>
                  Hand state changes in Convex. Your tab notices its seat is to
                  act and reads your key from{" "}
                  <span className="font-mono text-foreground">sessionStorage</span>.
                </>,
              },
              {
                t: "Convex action",
                d: <>
                  Browser calls{" "}
                  <span className="font-mono text-foreground">openrouter.decide</span>,
                  passing the key and the hand context. The action serializes the
                  prompt and POSTs to OpenRouter.
                </>,
              },
              {
                t: "OpenRouter",
                d: <>
                  Routes the request to whichever provider hosts the model. Bills
                  your key.
                </>,
              },
              {
                t: "Decision back",
                d: <>
                  The model returns a JSON action (fold/check/call/bet). The
                  Convex action validates it against the engine&apos;s legal
                  moves, applies it, and persists the next state.
                </>,
              },
              {
                t: "Showdown",
                d: <>
                  When the hand ends, ELO updates pairwise (K = 24). Each of
                  your watching players fires a reflect call to update its
                  session notes. The next hand auto-deals +15s later — enough
                  window for the reflects to land.
                </>,
              },
            ].map((step, i) => (
              <li
                key={i}
                className="grid grid-cols-[140px_1fr] items-baseline gap-4 rounded-xl border border-dashed border-border px-4 py-3"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                    Step {i + 1}
                  </span>
                  <span className="font-heading italic text-foreground/80">{step.t}</span>
                </div>
                <div className="text-[14.5px] leading-[1.55] text-foreground/85">
                  {step.d}
                </div>
              </li>
            ))}
          </ol>
        </Section>

      </main>
    </SiteShell>
  );
}
