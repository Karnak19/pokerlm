"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ModelCombobox } from "@/components/model-combobox";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { CURATED_MODELS, type ModelOption } from "@/lib/models";
import { Sparkles, ClipboardCheck } from "lucide-react";

const OR_STORAGE_KEY = "pokerlm.openrouter.key";

type Block = { kind: "text"; text: string } | { kind: "code"; text: string };

// Parse fenced ```code``` blocks out of a message. Everything else is text.
function parseBlocks(src: string): Block[] {
  const out: Block[] = [];
  const re = /```[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: src.slice(last, m.index) });
    out.push({ kind: "code", text: m[1].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ kind: "text", text: src.slice(last) });
  return out;
}

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("");
}

export function CoachSheet({
  open,
  onOpenChange,
  onApplyPrompt,
  models,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onApplyPrompt: (text: string) => void;
  models?: ModelOption[];
}) {
  const list = models ?? CURATED_MODELS;
  const [model, setModel] = useState(list[0]?.id ?? CURATED_MODELS[0].id);
  const [apiKey, setApiKey] = useState("");
  const [mounted, setMounted] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate key from sessionStorage post-mount */
  useEffect(() => {
    setMounted(true);
    try {
      setApiKey(sessionStorage.getItem(OR_STORAGE_KEY) ?? "");
    } catch {}
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Re-poll on open in case the user just set the key.
  useEffect(() => {
    if (!open) return;
    try {
      setApiKey(sessionStorage.getItem(OR_STORAGE_KEY) ?? "");
    } catch {}
  }, [open]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="gap-1.5 border-b border-border">
          <SheetTitle className="font-heading text-xl font-normal tracking-tight">
            Coach <em className="italic text-foreground/60">me</em>
          </SheetTitle>
          <SheetDescription>
            Iterate on your player&apos;s system prompt with a model of your choice. Chat is in-memory — closing this sheet wipes it.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b border-border px-4 py-3">
          <ModelCombobox models={list} value={model} onChange={setModel} />
        </div>

        {mounted && !apiKey ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Set your OpenRouter key in the nav (top right) to start chatting.
          </div>
        ) : (
          // Re-mount on open so chat history resets when the sheet closes.
          <CoachChat key={open ? "live" : "idle"} apiKey={apiKey} model={model} onApplyPrompt={onApplyPrompt} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CoachChat({
  apiKey,
  model,
  onApplyPrompt,
}: {
  apiKey: string;
  model: string;
  onApplyPrompt: (text: string) => void;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/coach",
        headers: { "x-openrouter-key": apiKey, "x-model": model },
      }),
    [apiKey, model],
  );

  const { messages, sendMessage, status } = useChat({ transport });

  function handleSubmit(msg: PromptInputMessage) {
    const text = msg.text?.trim();
    if (!text) return;
    sendMessage({ text });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Sparkles className="size-6" />}
              title="Ask for a prompt"
              description={
                'Try "give me a tight-aggressive prompt that 3-bets light from the button".'
              }
            />
          ) : (
            messages.map((m) => {
              const text = messageText(m.parts as { type: string; text?: string }[]);
              return (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.role === "assistant" ? (
                      <AssistantBody text={text} onApply={onApplyPrompt} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{text}</p>
                    )}
                  </MessageContent>
                </Message>
              );
            })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background/40 p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask the coach…" />
            <PromptInputSubmit
              status={status}
              disabled={status === "submitted" || status === "streaming"}
            />
          </PromptInputBody>
        </PromptInput>
      </div>
    </div>
  );
}

function AssistantBody({ text, onApply }: { text: string; onApply: (t: string) => void }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) =>
        b.kind === "text" ? (
          <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
            {b.text.trim()}
          </p>
        ) : (
          <div key={i} className="overflow-hidden rounded-md border border-border bg-input/30">
            <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12.5px] leading-[1.6] whitespace-pre-wrap break-words">
              {b.text}
            </pre>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-input/20 px-2 py-1.5">
              <Button size="sm" variant="outline" type="button" onClick={() => onApply(b.text)}>
                <ClipboardCheck />
                Use this prompt
              </Button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
