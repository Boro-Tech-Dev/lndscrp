import type { SignalItem } from "../lib/api";
import { SignalFeedRow } from "./SignalFeedRow";

type Props = {
  tenantSlug: string;
  signals: SignalItem[];
  variant?: "dashboard" | "signals";
  emptyText?: string;
};

export function SignalFeedList({
  tenantSlug,
  signals,
  variant = "dashboard",
  emptyText = "No signals match this filter."
}: Props) {
  if (signals.length === 0) {
    return <div className="px-3 py-8 text-center text-sm text-muted">{emptyText}</div>;
  }

  return signals.map((signal) => (
    <SignalFeedRow key={signal.signalId} tenantSlug={tenantSlug} signal={signal} variant={variant} />
  ));
}

