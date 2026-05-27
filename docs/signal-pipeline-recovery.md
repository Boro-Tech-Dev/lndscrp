# Signal pipeline recovery

Use when ingest jobs fail (e.g. Ollama OOM), `signals` stays empty, or `source_checks` show `failed`.

## Prerequisites

- Swap enabled: `bash infra/vps/setup-swap.sh` (see [deploy-vps.md](deploy-vps.md))
- Workers running: `worker-scheduler`, `worker-ingest`, Ollama healthy
- VPS throttles: `LANDSCRAPE_SCHEDULER_BURST_LIMIT=1`, `LANDSCRAPE_OLLAMA_GLOBAL_MAX_CONCURRENT=1`

## Reset failed sources for immediate re-poll

Scheduler skips sources until `last_checked_at` + `poll_frequency_minutes` elapses. Clear failed sources so the next scheduler tick enqueues them again:

```sql
UPDATE sources
SET last_checked_at = NULL, last_status = NULL
WHERE is_active = TRUE AND last_status = 'failed';
```

On the VPS:

```bash
cd /opt/landscrape
bash infra/vps/recover-ingest.sh
```

## Ollama smoke test

```bash
export COMPOSE_FILE=compose.yaml:compose.vps.yml:compose.traefik.yml:compose.registry.yml
docker compose exec worker-ingest wget -qO- --timeout=60 \
  --post-data='{"model":"llama3.2:3b","prompt":"ok","stream":false}' \
  --header='Content-Type: application/json' \
  http://ollama:11434/api/generate
```

Expect JSON with `"done":true`.

## Verify pipeline

```sql
SELECT status, COUNT(*) FROM source_checks
WHERE check_started_at > NOW() - INTERVAL '1 hour'
GROUP BY status;

SELECT COUNT(*) FROM signals;

SELECT job_type, status, COUNT(*) FROM job_runs GROUP BY 1, 2;
```

Watch ingest logs:

```bash
docker compose logs -f worker-scheduler worker-ingest
```

Expect `[ingest] start` / `[ingest] done ... newSignals=N`.

## Stuck `running` checks

`worker-reconcile` clears `source_checks` stuck in `running` for more than 30 minutes. To clear manually:

```sql
UPDATE source_checks
SET status = 'failed', check_completed_at = NOW(), error_message = 'manual recovery: stuck running'
WHERE status = 'running' AND check_started_at < NOW() - INTERVAL '30 minutes';
```

## X social

If only X sources are due, ensure the social profile is up (`./scripts/deploy-vps.sh up-social`) and the connector is configured per [x-social-ingest.md](x-social-ingest.md).
