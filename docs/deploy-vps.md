# VPS deploy — deliver-impact.com

Production host: **`root@72.61.5.60`** (Ubuntu 24.04, Traefik at `/docker/traefik/`).

Public URL: **https://deliver-impact.com** (web via Traefik). Admin console: **https://admin.deliver-impact.com** (admin role only; shares login with web). API, Keycloak, and databases stay on the Docker network.

### Access URLs (use these in the browser)

| App | URL |
|-----|-----|
| Web | https://deliver-impact.com |
| Admin | https://admin.deliver-impact.com |

Do **not** open container hostnames from `docker logs` (e.g. `http://e6f7f621c25c:3000`) or `http://72.61.5.60:3000` — port 3000 is not published on the VPS; only Traefik serves HTTPS.

Set `WEB_PUBLIC_URL` and `ADMIN_BASE_URL` in `.env` to match these hosts (see `.env.vps.example`). After changing them, redeploy: `docker compose up -d --build web admin`.

## Prerequisites

- DNS: `deliver-impact.com`, `www`, and `admin` → `72.61.5.60`
- SSH key for `root@72.61.5.60`
- ~93 GB free disk (16 GB swap + Docker images/volumes)

## 1. Install 16 GB swap (required, once per server)

```bash
ssh root@72.61.5.60
cd /opt/landscrape   # after sync in step 2, or copy script alone first
bash infra/vps/setup-swap.sh
free -h              # Swap: ~16 Gi
swapon --show
```

## 2. Sync repository

From your dev machine:

```bash
./scripts/rsync-to-vps.sh
```

Or manually (do **not** sync `.env` — it overwrites production secrets and cookie domain):

```bash
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude .env \
  --exclude apps/web/.next \
  --exclude apps/admin/.next \
  ./ root@72.61.5.60:/opt/landscrape/
```

Or `git clone` on the VPS if the repo is on GitHub.

## 3. Configure production `.env`

```bash
ssh root@72.61.5.60
cd /opt/landscrape
cp .env.vps.example .env
```

Replace every `CHANGE_ME_*` value. Example generators:

```bash
openssl rand -hex 32   # passwords and API keys
```

### X (Twitter) social ingest (optional)

On VPS the **xactions** stack is behind the Compose **`social` profile** (saves CPU/RAM by default). Enable it with:

```bash
COMPOSE_FILE=compose.yaml:compose.vps.yml:compose.traefik.yml \
  docker compose --profile social up -d
```

If you want X/Twitter posts to appear in the dashboard feed (as `social_intelligence` signals), you must configure the X connector secrets.

- **Prerequisite**: Set `LANDSCRAPE_CREDENTIALS_KEY` in `.env` first. The API refuses to store social connector secrets unless this is set.
- **Then**: Follow the setup in [`docs/x-social-ingest.md`](x-social-ingest.md), which uses [`scripts/configure-x-social-connector.sh`](../scripts/configure-x-social-connector.sh) to store `auth_token` and `ct0` encrypted into the `connectors.connection_config.encrypted_payload`.

**Important:** On first boot, `KEYCLOAK_CLIENT_SECRET` must match `infra/keycloak/landscrape-realm.json` (`landscrape-web-secret-change-in-prod` unless you changed the realm). Set `AUTH_COOKIE_DOMAIN=.deliver-impact.com` and `ADMIN_BASE_URL=https://admin.deliver-impact.com` so admin shares the web login. Rotate demo users (`demo@landscrape.local` / `admin@landscrape.local`) before sharing the site.

Update `DATABASE_URL` and `STORAGE_SECRET_KEY` to use the same passwords you set for `POSTGRES_PASSWORD` and `MINIO_ROOT_PASSWORD`.

## 4. Build and start

Limit parallel builds on 8 GB RAM (prefer **`1`** on first deploy or after CPU alerts; use `2` only when swap is healthy):

```bash
export COMPOSE_PARALLEL_LIMIT=1
export DOCKER_BUILDKIT=1

COMPOSE_FILE=compose.yaml:compose.vps.yml:compose.traefik.yml \
  docker compose up -d --build
```

First boot: **20–45 minutes** (deduplicated images + Ollama model ~2 GB). Swap use during build is normal.

### Staged start (lower peak CPU)

Instead of building and starting everything at once:

```bash
cd /opt/landscrape
export COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=1
export COMPOSE_FILE=compose.yaml:compose.vps.yml:compose.traefik.yml

# 1) Data + models
docker compose up -d postgres redis minio ollama
docker compose up -d ollama-init keycloak

# 2) App tier (build if needed)
docker compose up -d --build mcp-fda mcp-pubmed mcp-clinicaltrials agent api web admin

# 3) Workers last (heaviest steady-state CPU)
docker compose up -d --build worker-scheduler worker-ingest worker-embed worker-enrich worker-reconcile worker-inbound worker-export worker-portal
```

Optional **X/social** stack (Puppeteer): `docker compose --profile social up -d` (see [compose.vps.yml](../compose.vps.yml)).

Redeploy only what changed when possible (e.g. `docker compose up -d --build web admin`).

### Shared images

Compose builds **~8 unique images** (not one per worker):

- `landscrape-worker:prod` — all worker roles
- `landscrape-mcp-sidecar:prod` — three MCP sidecars
- `landscrape-agent:prod` — user-facing agent (`agent-enrich` is optional; off on VPS by default)
- `landscrape-xactions:prod` — xactions-api + xactions-worker
- `landscrape-api:prod`, `landscrape-web:prod`, `landscrape-admin:prod`

## 5. Verify

```bash
curl -sI https://deliver-impact.com
docker compose exec api wget -qO- http://127.0.0.1:4000/health
free -h
docker stats --no-stream
```

- Sign in at https://deliver-impact.com
- Hard-refresh the page several times — you should stay signed in (document request **200**, not `307` to `/login`)
- Repeat on https://www.deliver-impact.com and https://admin.deliver-impact.com
- Auth uses a **single** `landscrape_session` cookie (session id in Redis). After upgrading from older builds, clear site data once to remove legacy `landscrape_access` / `landscrape_refresh` / `landscrape_email` cookies.
- Admin users: open **Admin** in the top bar, or go to https://admin.deliver-impact.com (shared session when `AUTH_COOKIE_DOMAIN=.deliver-impact.com`)
- From outside: ports **5432, 4000, 8080** on the public IP should be **closed**

### Redeploy web + admin only (auth fixes)

From your machine:

```bash
./scripts/rsync-to-vps.sh
```

On the VPS:

```bash
cd /opt/landscrape
export COMPOSE_PARALLEL_LIMIT=1 DOCKER_BUILDKIT=1
COMPOSE_FILE=compose.yaml:compose.vps.yml:compose.traefik.yml docker compose up -d --build web admin
```

## Admin console

Public at **https://admin.deliver-impact.com** for users with the Keycloak **admin** role. Requires:

1. DNS `admin.deliver-impact.com` → server IP
2. `.env`: `ADMIN_BASE_URL=https://admin.deliver-impact.com` and `AUTH_COOKIE_DOMAIN=.deliver-impact.com`
3. Redeploy `web` and `admin` after env changes (users must sign in again once for shared cookies)

While signed in on the main site, admin users see an **Admin** link in the header.

### SSH fallback (no DNS)

No Traefik route needed locally. Use SSH port forward:

```bash
ssh -L 3001:127.0.0.1:3001 root@72.61.5.60
```

Open http://localhost:3001 (requires `127.0.0.1:3001:3001` published on the VPS — see troubleshooting).

## Local smoke test (before VPS)

```bash
docker compose config
export COMPOSE_PARALLEL_LIMIT=2
docker compose build
docker images | grep landscrape
```

## Troubleshooting

| Issue | Action |
|-------|--------|
| `DNS_PROBE_FINISHED_NXDOMAIN` / URL like `e6f7f621c25c:3000` | Wrong URL — use https://deliver-impact.com. Next.js may log `Local: http://<container-id>:3000`; ignore it. Set `WEB_PUBLIC_URL` / `ADMIN_BASE_URL` in `.env` and redeploy `web` + `admin`. |
| OOM during build | Confirm swap (`free -h`); lower `COMPOSE_PARALLEL_LIMIT` to 1 |
| TLS / 404 on domain | Check DNS; Traefik logs: `docker logs traefik-traefik-1` |
| Login fails | Keycloak client secret vs `.env`; realm redirect URIs |
| `intelligence-tools` / `x-twitter` build error | Ensure Dockerfiles build `@landscrape/x-twitter` before `@landscrape/intelligence-tools` |
| Playwright `page.goto` timeouts on competitor sites | Migration `016_render_waituntil_domcontentloaded.sql` runs on fresh DBs; existing DBs: same `UPDATE` as in that file |
| High sustained CPU after deploy | See `.env.vps.example` throttles; `compose.vps.yml` disables `agent-enrich` and optional `--profile social`; `docker stats --no-stream` |
| Stuck ingest / `source_checks` stuck in `running` | `worker-reconcile` clears checks older than 30 minutes; or run the SQL in the signal-pipeline recovery runbook |

## Compose files

| File | Purpose |
|------|---------|
| `compose.yaml` | Base stack |
| `compose.vps.yml` | No public ports, CPU/RAM limits, scheduler/Ollama throttles, optional `social` profile |
| `compose.traefik.yml` | HTTPS routing for `web` |
