import crypto from "crypto";
import type { ToolInput } from "./types";

const DENYLIST_TOOL_PATTERNS = [
  /fhir/i,
  /patient/i,
  /epic/i,
  /cerner/i,
  /healthlake/i,
  /lab[-_]?results/i,
  /imaging/i,
  /dicom/i,
  /prior[-_]?auth/i,
  /\bmpi\b/i,
  /ehr/i,
  /medplum/i,
  /oncofiles/i,
  /health[-_]?record/i,
  /break[-_]?glass/i,
];

const ALLOWED_TOOL_IDS = new Set([
  "native.pubmed.search",
  "native.clinicaltrials.search",
  "native.openfda.search",
  "native.tenant.signals",
  "native.x.search",
  "native.x.profile",
  "mcp.fda.search",
  "mcp.pubmed.search",
  "mcp.clinicaltrials.search",
]);

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/;
const MRN_PATTERN = /\b(?:MRN|medical record)[:\s#]*\d{4,}\b/i;
const DOB_PATTERN = /\b(?:DOB|date of birth)[:\s]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/i;

const MAX_INPUT_JSON_LENGTH = 8_000;

export class PhiPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhiPolicyError";
  }
}

export function assertToolAllowed(toolId: string): void {
  if (!ALLOWED_TOOL_IDS.has(toolId)) {
    throw new PhiPolicyError(`Tool not allowlisted: ${toolId}`);
  }
  for (const pattern of DENYLIST_TOOL_PATTERNS) {
    if (pattern.test(toolId)) {
      throw new PhiPolicyError(`Tool denied by PHI policy: ${toolId}`);
    }
  }
}

export function scanTextForPhi(text: string, label: string): void {
  const trimmed = text.trim();
  if (trimmed.length > MAX_INPUT_JSON_LENGTH) {
    throw new PhiPolicyError(`${label}: input exceeds maximum length (${MAX_INPUT_JSON_LENGTH})`);
  }
  if (SSN_PATTERN.test(trimmed)) {
    throw new PhiPolicyError(`${label}: possible SSN detected`);
  }
  if (MRN_PATTERN.test(trimmed)) {
    throw new PhiPolicyError(`${label}: possible MRN detected`);
  }
  if (DOB_PATTERN.test(trimmed)) {
    throw new PhiPolicyError(`${label}: possible DOB detected`);
  }
}

export function assertInputSafe(input: ToolInput, label = "tool input"): void {
  const serialized = JSON.stringify(input);
  scanTextForPhi(serialized, label);
}

export function redactInputForAudit(input: ToolInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.length > 120) {
      out[key] = `${value.slice(0, 80)}…[${value.length} chars]`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function hashInput(input: ToolInput): string {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16);
}

export function listAllowedToolIds(): string[] {
  return [...ALLOWED_TOOL_IDS];
}
