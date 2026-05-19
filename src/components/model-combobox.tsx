"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatMtok, type ModelOption } from "@/lib/models";

function PriceBadge({ m, className }: { m: ModelOption; className?: string }) {
  if (m.priceIn === undefined && m.priceOut === undefined) return null;
  return (
    <span className={cn("font-mono text-[10.5px] tabular-nums text-muted-foreground", className)}>
      {formatMtok(m.priceIn)} <span className="opacity-50">in</span>
      {" · "}
      {formatMtok(m.priceOut)} <span className="opacity-50">out</span>
      <span className="ml-1 opacity-50">/Mtok</span>
    </span>
  );
}

export function ModelCombobox({
  models,
  value,
  onChange,
  loading,
}: {
  models: ModelOption[];
  value: string;
  onChange: (v: string) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = models.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between gap-3 font-mono text-sm"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate">
              {selected ? selected.label : value || (loading ? "Loading models…" : "Select a model…")}
            </span>
            {selected && <PriceBadge m={selected} className="shrink-0" />}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(value, search) => {
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search models…" />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.label} ${m.id}`}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === m.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{m.label}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">{m.id}</span>
                    </div>
                    <PriceBadge m={m} className="shrink-0" />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
