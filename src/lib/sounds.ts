"use client";

/**
 * Game-sound hooks built on top of `use-sound` (Howler under the hood).
 * Files live in /public.
 *
 * Mute preference persists per-browser in localStorage; the room page
 * exposes a toggle in the top-right.
 */

import { useEffect, useState } from "react";
import useSound from "use-sound";

const MUTE_KEY = "pokerlm.muted";

function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Returns a stable `play` function for the card-deal sound. Honors the
 * mute preference — call it freely, it's a no-op while muted.
 */
export function useCardSound() {
  const [play] = useSound("/playing-cards-1.mp3", { volume: 0.5 });
  return () => {
    if (readMuted()) return;
    play();
  };
}

/**
 * Returns a stable `play` function for the chip-placing sound. Honors
 * the mute preference.
 */
export function useChipSound() {
  const [play] = useSound("/placing-chips.mp3", { volume: 0.45 });
  return () => {
    if (readMuted()) return;
    play();
  };
}

export function useSoundMute(): {
  isMuted: boolean;
  toggle: () => void;
  mounted: boolean;
} {
  // Read localStorage after mount to keep SSR + CSR in lockstep.
  const [mounted, setMounted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- client-only localStorage hydration */
  useEffect(() => {
    setMounted(true);
    setIsMuted(readMuted());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggle() {
    setIsMuted((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return { isMuted, toggle, mounted };
}
