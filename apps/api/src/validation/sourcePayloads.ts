import { z } from "zod";

export const SOURCE_TYPES = [
  "competitor_site",
  "publication",
  "congress",
  "regulatory",
  "payer",
  "news",
  "press",
  "crm",
  "email",
  "web_analytics",
  "social",
  "upload",
  "field_feedback",
  "other"
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

const uuid = z.string().uuid();

function hasClinicalTrialsQuery(cfg: Record<string, unknown>): boolean {
  return Boolean(
    cfg["query.cond"] ||
      cfg["query.term"] ||
      cfg["query.intr"] ||
      cfg["query.titles"] ||
      cfg["query.locn"] ||
      cfg.condition ||
      cfg.intervention
  );
}

export const createSourceBodySchema = z
  .object({
    source_name: z.string().min(1).max(500),
    source_type: z.enum(SOURCE_TYPES),
    base_url: z.string().url().optional().nullable(),
    external_id: z.string().max(200).optional().nullable(),
    source_group_id: uuid.optional().nullable(),
    access_notes: z.string().max(2000).optional().nullable(),
    poll_frequency_minutes: z.number().int().min(1).max(10080).default(60),
    is_active: z.boolean().default(true),
    source_config: z.record(z.unknown()).default({})
  })
  .superRefine((data, ctx) => {
    const cfg = data.source_config as Record<string, unknown>;
    if (data.source_type === "competitor_site" && !data.base_url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "competitor_site requires base_url", path: ["base_url"] });
    }
    if (data.source_type === "regulatory" && !data.base_url && cfg.provider !== "openfda") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "regulatory requires base_url unless source_config.provider is openfda",
        path: ["base_url"]
      });
    }
    if (data.source_type === "payer" && !data.base_url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "payer requires base_url", path: ["base_url"] });
    }
    if (data.source_type === "congress" && !data.base_url) {
      const okTrials =
        cfg.provider === "clinicaltrials_v2" || hasClinicalTrialsQuery(cfg);
      if (!okTrials) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "congress requires base_url or ClinicalTrials query fields (e.g. source_config.query.cond)",
          path: ["base_url"]
        });
      }
    }
    if (data.source_type === "publication") {
      const prov = typeof cfg.provider === "string" ? cfg.provider.trim().toLowerCase() : "";
      if (prov === "europepmc") {
        const hasEpmc =
          (typeof cfg.epmcQuery === "string" && cfg.epmcQuery.trim().length > 0) ||
          (typeof cfg.query === "string" && cfg.query.trim().length > 0);
        if (!hasEpmc) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "publication with provider europepmc requires source_config.epmcQuery or query",
            path: ["source_config", "epmcQuery"]
          });
        }
      } else {
        const hasQuery = typeof cfg.query === "string" && cfg.query.trim().length > 0;
        if (!data.base_url && !hasQuery) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "publication requires base_url and/or source_config.query (PubMed esearch term)",
            path: ["base_url"]
          });
        }
      }
    }
    if ((data.source_type === "news" || data.source_type === "press") && !data.base_url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "news and press sources require base_url (RSS or HTML feed URL)",
        path: ["base_url"]
      });
    }
    if (data.source_type === "social") {
      const provider = typeof cfg.provider === "string" ? cfg.provider.trim().toLowerCase() : "";
      if (provider !== "x") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'social sources require source_config.provider "x"',
          path: ["source_config", "provider"],
        });
      }
      const connectorId = typeof cfg.connectorId === "string" ? cfg.connectorId : "";
      if (!z.string().uuid().safeParse(connectorId).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source_config.connectorId (UUID) is required for social X sources",
          path: ["source_config", "connectorId"],
        });
      }
      const mode = typeof cfg.mode === "string" ? cfg.mode : "";
      if (mode !== "search" && mode !== "account" && mode !== "hashtag") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source_config.mode must be search, account, or hashtag",
          path: ["source_config", "mode"],
        });
      } else if (mode === "search") {
        const query = typeof cfg.query === "string" ? cfg.query.trim() : "";
        if (!query) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "source_config.query is required when mode is search",
            path: ["source_config", "query"],
          });
        }
      } else if (mode === "account") {
        const username = typeof cfg.username === "string" ? cfg.username.trim() : "";
        if (!username) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "source_config.username is required when mode is account",
            path: ["source_config", "username"],
          });
        }
      } else if (mode === "hashtag") {
        const hashtag = typeof cfg.hashtag === "string" ? cfg.hashtag.trim() : "";
        if (!hashtag) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "source_config.hashtag is required when mode is hashtag",
            path: ["source_config", "hashtag"],
          });
        }
      }
      const scraper = typeof cfg.scraper === "string" ? cfg.scraper.trim().toLowerCase() : "";
      if (scraper && scraper !== "api" && scraper !== "http") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'source_config.scraper must be "api" or "http" when set',
          path: ["source_config", "scraper"],
        });
      }
      const limit = cfg.limit;
      if (limit !== undefined) {
        const n = typeof limit === "number" ? limit : Number(limit);
        if (!Number.isFinite(n) || n < 1 || n > 200 || !Number.isInteger(n)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "source_config.limit must be an integer between 1 and 200",
            path: ["source_config", "limit"],
          });
        }
      }
    }
    if (cfg.authMode === "portal") {
      if (typeof cfg.connectorId !== "string" || !z.string().uuid().safeParse(cfg.connectorId).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source_config.connectorId (UUID) is required when authMode is portal",
          path: ["source_config", "connectorId"]
        });
      }
      if (!data.base_url) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "portal sources require base_url (post-login target page)", path: ["base_url"] });
      }
    }
  });

export type CreateSourceBody = z.infer<typeof createSourceBodySchema>;

export const patchSourceBodySchema = z
  .object({
    base_url: z.string().url().optional().nullable(),
    external_id: z.string().max(200).optional().nullable(),
    access_notes: z.string().max(2000).optional().nullable(),
    poll_frequency_minutes: z.number().int().min(1).max(10080).optional(),
    is_active: z.boolean().optional(),
    source_config: z.record(z.unknown()).optional()
  })
  .superRefine((data, ctx) => {
    const cfg = data.source_config as Record<string, unknown> | undefined;
    if (cfg && cfg.authMode === "portal" && cfg.connectorId !== undefined) {
      if (typeof cfg.connectorId !== "string" || !z.string().uuid().safeParse(cfg.connectorId).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source_config.connectorId must be a UUID when authMode is portal",
          path: ["source_config", "connectorId"]
        });
      }
    }
  });

export type PatchSourceBody = z.infer<typeof patchSourceBodySchema>;
