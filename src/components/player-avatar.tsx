/**
 * Player avatar — DiceBear `bottts` style, keyed by the player's name (or
 * any stable seed). Renders an <img> pointing at the DiceBear HTTP API,
 * so no client-side library is needed. Falls back to the `.pl-av` letter
 * disc when no seed is provided.
 *
 * https://www.dicebear.com/styles/bottts/
 */

import { cn } from "@/lib/utils";

const ENDPOINT = "https://api.dicebear.com/9.x/bottts/svg";

function avatarUrl(seed: string): string {
  const params = new URLSearchParams({
    seed,
    radius: "20",
    backgroundType: "gradientLinear,solid",
    backgroundColor: "1a3329,2a4d3a,2a3d52",
  });
  return `${ENDPOINT}?${params.toString()}`;
}

export function PlayerAvatar({
  seed,
  fallback,
  size = 36,
  className,
  style,
}: {
  /** Stable identifier — usually the player's name or _id. */
  seed: string | null | undefined;
  /** Letter shown if no seed (defaults to "?"). */
  fallback?: string;
  /** Pixel size of the square avatar. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const trimmed = (seed ?? "").trim();
  if (!trimmed) {
    return (
      <span
        className={cn("pl-av", className)}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.46), ...style }}
      >
        {fallback ?? "?"}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-block shrink-0 overflow-hidden rounded-full border border-primary/25 bg-felt",
        className,
      )}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- DiceBear SVGs are tiny and scale natively; next/image adds no value here */}
      <img
        src={avatarUrl(trimmed)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="block size-full"
      />
    </span>
  );
}
