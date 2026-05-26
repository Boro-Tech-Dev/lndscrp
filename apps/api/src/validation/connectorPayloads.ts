import { z } from "zod";

export const CONNECTOR_TYPES = ["crm", "email", "analytics", "social", "upload", "other"] as const;

export const createConnectorBodySchema = z.object({
  connector_name: z.string().min(1).max(200),
  connector_type: z.enum(CONNECTOR_TYPES),
  connection_config: z.record(z.unknown()).default({}),
  /** Merged into encrypted_payload when LANDSCRAPE_CREDENTIALS_KEY is set (portal login, API tokens, etc.) */
  secrets: z.record(z.unknown()).optional()
});

export type CreateConnectorBody = z.infer<typeof createConnectorBodySchema>;

export const patchConnectorBodySchema = z.object({
  connector_name: z.string().min(1).max(200).optional(),
  is_active: z.boolean().optional(),
  connection_config: z.record(z.unknown()).optional(),
  secrets: z.record(z.unknown()).optional()
});

export type PatchConnectorBody = z.infer<typeof patchConnectorBodySchema>;
