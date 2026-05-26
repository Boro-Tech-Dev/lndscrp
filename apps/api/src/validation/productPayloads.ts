import { z } from "zod";

const lifecycleStage = z.enum(["pipeline", "approved", "generic"]);
const productRole = z.enum(["owned", "competitor"]);

const optionalUrl = z.string().url().nullable().optional();
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export const createProductBodySchema = z.object({
  brand_name: z.string().min(1).max(120),
  generic_name: z.string().min(1).max(120),
  company: z.string().max(200).nullable().optional(),
  role: productRole.optional(),
  therapeutic_class: z.string().max(200).nullable().optional(),
  indications: z.array(z.string().max(80)).max(20).optional(),
  lifecycle_stage: lifecycleStage.optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
  hcp_url: optionalUrl,
  dtc_url: optionalUrl,
  label_url: optionalUrl,
  curated_pdufa_date: optionalDate,
  curated_approval_date: optionalDate,
  curated_loe_date: optionalDate,
  enrich_intervention: z.string().max(120).nullable().optional(),
  enrich_brand_search: z.string().max(120).nullable().optional(),
});

export const patchProductBodySchema = createProductBodySchema.partial();
