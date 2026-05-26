import { z } from "zod";

const congressPriority = z.enum(["imminent", "pivotal", "expected", "watch"]);
const productRole = z.enum(["owned", "competitor"]);
const brandPresence = z.enum(["confirmed", "expected"]);

const brandSchema = z.object({
  brandName: z.string().min(1).max(120),
  role: productRole,
  presence: brandPresence,
});

const headlineSessionSchema = z.object({
  title: z.string().min(1).max(500),
  brandName: z.string().min(1).max(120),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
  sessionLabel: z.string().max(300).optional(),
  abstractId: z.string().max(80).optional(),
  url: z.string().url().optional(),
});

const optionalUrl = z.string().url().nullable().optional();

export const createCongressEventBodySchema = z.object({
  event_slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  acronym: z.string().min(1).max(40),
  name: z.string().min(1).max(300),
  location: z.string().min(1).max(300),
  timezone: z.string().min(1).max(80),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  sort_order: z.number().int().min(0).max(999).optional(),
  focus_tags: z.array(z.string().max(40)).max(20).optional(),
  priority: congressPriority.optional(),
  summary: z.string().max(2000).optional(),
  brands: z.array(brandSchema).max(30).optional(),
  headline_sessions: z.array(headlineSessionSchema).max(20).optional(),
  program_url: optionalUrl,
});

export const patchCongressEventBodySchema = createCongressEventBodySchema.partial();
