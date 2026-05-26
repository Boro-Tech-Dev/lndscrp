# MCP Clinical Reference Kit

LandScrape integrates the **Clinical Reference Kit** workflow: public L2 healthcare reference tools for market intelligence. No PHI/PII is permitted.

## Architecture

- **Native tools** (`packages/intelligence-tools/src/native/`): direct HTTP to PubMed, ClinicalTrials.gov, openFDA — used for batch ingest enrichment and agent fallback.
- **MCP sidecars** (`packages/mcp-sidecars`): standardized MCP tool surface over the same public APIs.
- **Agent** (`apps/agent`): Ollama tool orchestration with PHI policy gate.
- **Dual path**: scheduled ingest keeps native worker providers; agent and enrichment use the unified tool registry.

## Allowed tools (L2 only)

| Tool ID | Source |
|---------|--------|
| `native.pubmed.search` | NCBI E-utilities |
| `native.clinicaltrials.search` | ClinicalTrials.gov v2 |
| `native.openfda.search` | openFDA |
| `native.tenant.signals` | Tenant workspace DB |
| `mcp.fda.search` | MCP sidecar |
| `mcp.pubmed.search` | MCP sidecar |
| `mcp.clinicaltrials.search` | MCP sidecar |

Denied by policy: FHIR, EHR, patient, imaging, prior-auth, and any non-allowlisted tool ID.

## Environment variables

See [`.env.example`](../.env.example):

- `OLLAMA_AGENT_MODEL` — agent orchestration model (default `llama3.2:3b`, same as ingest model)
- `AGENT_PORT` / `AGENT_INTERNAL_URL`
- `MCP_FDA_URL`, `MCP_PUBMED_URL`, `MCP_CLINICALTRIALS_URL` — sidecar bases (default in compose)
- `LANDSCRAPE_REFERENCE_TOOLS` — `mcp` | `native` | `auto` (default `auto`; compose sets `mcp`)
- `NCBI_API_KEY`, `OPENFDA_API_KEY` — optional rate-limit / quota improvements
- `AGENT_INFERENCE_BACKEND` — `ollama` or `openai_compat` for agent chat only

## Docker Compose

The core stack includes `agent` and **three MCP sidecars** (FDA, PubMed, ClinicalTrials.gov). They start with a normal `docker compose up -d --build` — no profile flag required.

```bash
docker compose up -d --build
```

Set `LANDSCRAPE_REFERENCE_TOOLS=mcp` (default in compose) so the agent uses MCP tools only (not duplicate native + MCP). Use `native` if sidecars are unavailable.

Without MCP URLs configured, the agent uses **native tools only** (fully functional).

## PHI policy

- Tool allowlist enforced in `packages/intelligence-tools/src/phiPolicy.ts`
- User/agent inputs scanned for SSN/MRN/DOB patterns
- Tool audit logs store **hashed/redacted** inputs only (`agent_tool_audit`)
- UI disclaimer on `/research`

## Signal enrichment

After ingest, high-importance signals (default ≥75) or sources with `source_config.enrichWithAgent: true` enqueue `enrich:signal` jobs. Failures are non-fatal.

## Operations

- Agent health: `GET http://localhost:4010/health`
- Sidecar health: `GET http://localhost:4020/health` (fda), `:4021` (pubmed), `:4022` (clinicaltrials)
- Usage telemetry: `ollama_usage_events.operation = 'agent_turn'`

## Upgrading MCP servers

Pin sidecar images via `infra/docker/mcp-sidecars.Dockerfile`. Rebuild with `docker compose build mcp-fda mcp-pubmed mcp-clinicaltrials`.

## Related

- [X / Twitter via XActions](x-twitter-xactions.md) — browser ingest stack (not part of this MCP kit)
