"use client";

import { useEffect, useState } from "react";

type Props = {
  startsAt: string;
  endsAt: string;
};

const REFRESH_MS = 12 * 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "";
  const totalHours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days === 0) parts.push(`${hours}h`);
  return parts.join(" ");
}

export function CongressCountdown({ startsAt, endsAt }: Props) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const start = new Date(startsAt).getTime();
      const end = new Date(endsAt).getTime();
      if (now >= end) {
        setLabel("Ended");
        return;
      }
      if (now >= start) {
        setLabel("Live now");
        return;
      }
      setLabel(`Starts in ${formatCountdown(start - now)}`);
    };
    tick();
    const id = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [startsAt, endsAt]);

  const isLive = label === "Live now";
  const isEnded = label === "Ended";

  return (
    <div
      className={
        isLive
          ? "rounded-soft bg-accent-green/15 px-3 py-2 text-sm font-semibold tabular-nums text-accent-green"
          : isEnded
            ? "rounded-soft bg-stone-100 px-3 py-2 text-sm font-medium tabular-nums text-muted"
            : "rounded-soft bg-accent-brown/10 px-3 py-2 text-sm font-semibold tabular-nums text-stone-900"
      }
    >
      {label || "…"}
    </div>
  );
}
