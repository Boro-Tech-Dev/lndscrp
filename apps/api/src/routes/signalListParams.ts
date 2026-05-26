import { z } from "zod";
import type { SignalType } from "@landscrape/types";
import type { SignalListSort } from "../repositories/signalRepository";

const allowedTypes = [
  "competitive_activity",
  "clinical_landscape",
  "congress_intelligence",
  "market_access",
  "regulatory",
  "social_intelligence",
  "professional_discourse",
  "internal_performance"
] as const satisfies readonly SignalType[];

const sortSchema = z
  .enum(["updated_desc", "importance_desc", "first_seen_desc"])
  .default("updated_desc");

const schema = z.object({
  limit: z.coerce.number().finite().int().min(1).max(100).default(50),
  offset: z.coerce.number().finite().int().min(0).default(0),
  sort: sortSchema,
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  excludeTypes: z.string().trim().optional(),
  hide: z.string().trim().optional(),
});

export function parseSignalListParams(query: unknown): {
  limit: number;
  offset: number;
  sort: SignalListSort;
  from?: string;
  to?: string;
  excludeTypes: SignalType[];
} {
  const parsed = schema.parse(query);

  const rawExclude = parsed.excludeTypes ?? parsed.hide ?? "";
  const allowed = new Set<string>(allowedTypes);
  const excludeTypes: SignalType[] = rawExclude
    ? rawExclude
        .split(",")
        .map((t) => t.trim())
        .filter((t): t is SignalType => allowed.has(t))
    : [];

  return {
    limit: parsed.limit,
    offset: parsed.offset,
    sort: parsed.sort,
    from: parsed.from,
    to: parsed.to,
    excludeTypes
  };
}

