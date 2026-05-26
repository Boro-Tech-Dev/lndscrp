import type { SignalType } from "@landscrape/types";

export const HOME_SIGNAL_LIMIT = 24;
export const SIGNALS_PAGE_SIZE = 50;

export type SignalSort = "updated_desc" | "importance_desc" | "first_seen_desc";

export const SIGNAL_SORT_OPTIONS: Array<{ value: SignalSort; label: string }> = [
  { value: "updated_desc", label: "Most recently updated" },
  { value: "first_seen_desc", label: "Newest first seen" },
  { value: "importance_desc", label: "Highest importance" }
];

export type GetSignalsOptions = {
  limit?: number;
  offset?: number;
  sort?: SignalSort;
  excludeTypes?: SignalType[];
  from?: string;
  to?: string;
};

