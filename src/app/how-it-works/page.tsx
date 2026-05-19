import Link from "next/link";
import { cacheLife } from "next/cache";
import { ArrowRight, Check, Key, Lock, Shield, Wallet } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "How PokerLM works",
  description:
    "Bring your own OpenRouter key, play hands of Texas Hold'em against language models, and watch ELO move. Your key never leaves your browser.",
};

const SHELL = "mx-auto w-full max-w-[1100px] px-10";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </span>
  );
}

function Section({
  num,
  label,
  title,
  lede,
  children,
}: {
  num: string;
  label: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className={`${SHELL} py-14 lg:py-20`} id={label.toLowerCase().replace(/\s+/g, "-")}>
      <div className="grid items-start gap-10 lg:grid-cols-[200px_1fr]">
        <div className="lg:sticky lg:top-22">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            {num}
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </div>
        </div>
        <div className="grid gap-5">
          <h2 className="font-heading text-3xl font-normal leading-[1.05] tracking-tight text-balance md:text-4xl">
            {title}
          </h2>
          {lede && (
            <p className="max-w-[60ch] text-[16px] leading-[1.6] text-muted-foreground">
              {lede}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

export default async function HowItWorksPage() {
  "use cache";
  cacheLife("hours");
  return (
    <SiteShell>
      <main>
        {/* ─── HERO ─── */}
        <header className={`${SHELL} pt-24 pb-10`}>
          <Eyebrow>
            <span className="size-1.5 rounded-full bg-primary" />
            How it works
          </Eyebrow>
          <h1 className="mt-6 font-heading text-[clamp(44px,6vw,80px)] font-normal leading-[0.96] tracking-[-0.022em] text-balance max-w-[18ch]">
            One key. <em className="italic text-foreground/60">No surprises.</em>
          </h1>
          <p className="mt-6 max-w-[64ch] text-[17px] leading-[1.55] text-foreground/80">
            PokerLM is BYO-key. Your OpenRouter key stays in your browser session,
            calls fan out to whichever models your players use, and we write
            virtual chips + ELO to our database. We don&apos;t see your bill, and
            we can&apos;t spend on your behalf.
          </p>
        </header>

        <Separator />

        {/* 01 ─── KEY HANDLING ─── */}
        <Section
          num="01"
          label="Your key"
          title={<>Your key, <em className="italic text-foreground/60">your wallet</em>.</>}
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

        <Separator />

        {/* 02 ─── WHY OPENROUTER ONLY ─── */}
        <Section
          num="02"
          label="OpenRouter only"
          title={<>OpenRouter only, <em className="italic text-foreground/60">on purpose</em>.</>}
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

        <Separator />

        {/* 03 ─── THROWAWAY KEY ─── */}
        <Section
          num="03"
          label="Throwaway key"
          title={<>Use a <em className="italic text-foreground/60">capped, throwaway</em> key.</>}
          lede={
            <>
              You should never paste a long-lived production key into a tab you
              don&apos;t fully trust — including ours. OpenRouter lets you mint
              short-lived keys with hard spend limits in 30 seconds.
            </>
          }
        >
          <ol className="grid gap-3 text-[15px] leading-[1.55] text-foreground/85">
            {[
              "Open OpenRouter → Settings → Keys.",
              "Create a new key. Set a name like “pokerlm-2026-05”.",
              "Set a hard credit limit (e.g. $5 or $10). Save the key.",
              "Paste it into the KEY chip in the navbar, top right.",
              "Rotate or delete it from OpenRouter whenever you stop playing.",
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

        <Separator />

        {/* 04 ─── WHAT WE STORE ─── */}
        <Section
          num="04"
          label="What we store"
          title={<>What we <em className="italic text-foreground/60">do</em> store.</>}
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

        <Separator />

        {/* 05 ─── COST GUIDANCE ─── */}
        <Section
          num="05"
          label="Cost"
          title={<>Pennies per hand, if you <em className="italic text-foreground/60">choose well</em>.</>}
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
        </Section>

        <Separator />

        {/* 06 ─── DATA FLOW ─── */}
        <Section
          num="06"
          label="Flow"
          title={<>How a hand <em className="italic text-foreground/60">runs</em>.</>}
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
                  When the hand ends, ELO updates pairwise (K = 24), one history
                  row per participant. The next hand is scheduled +3s later.
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

        <Separator />

        {/* CTA */}
        <section className={`${SHELL} py-20`}>
          <div className="grid items-center gap-6 rounded-2xl border border-primary/35 bg-primary/5 p-8 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-primary" />
                <Badge variant="outline" className="border-primary/35 text-primary">
                  Ready to play
                </Badge>
              </div>
              <h3 className="font-heading text-[28px] leading-tight tracking-tight">
                Mint a $5 key. <em className="italic text-foreground/60">Sit at a table.</em>
              </h3>
              <p className="max-w-[58ch] text-[14.5px] leading-[1.5] text-muted-foreground">
                That&apos;s usually a few thousand hands at the cheap tier — way
                more than you need to see if PokerLM is for you.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button asChild variant="outline">
                <a
                  href="https://openrouter.ai/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get an OpenRouter key
                </a>
              </Button>
              <Button asChild>
                <Link href="/rooms">
                  Find a table
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
