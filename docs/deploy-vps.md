# VPS deploy — deliver-impact.com

Production host: **`root@72.61.5.60`** (Ubuntu 24.04, Traefik at `/docker/traefik/`).

Public URL: **https://deliver-impact.com** (web via Traefik). Admin console: **https://admin.deliver-impact.com** (admin role only; shares login with web). API, Keycloak, and databases stay on the Docker network.

### Access URLs (use these in the browser)

| App | URL |
|-----|-----|
| Web | https://deliver-impact.com |
| Admin | https://admin.deliver-impact.com |

Do **not** open container hostnames from `docker logs` (e.g. `http://e6f7f621c25c:3000`) or `http://72.61.5.60:3000` — port 3000 is not published on the VPS; only Traefik serves HTTPS.

Set `WEB_PUBLIC_URL` and `ADMIN_BASE_URL` in `.env` to match these hosts (see `.env.vps.example`). After changing them, redeploy web + admin: `./scripts/deploy-vps.sh up-web` (GHCR) or `docker compose up -d --build web admin` (local build on VPS).

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

Default destination is **`root@72.61.5.60:/opt/landscrape/`** (no arguments). Do not use documentation placeholders like `user@other-host`.

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

Set GHCR pull settings (lowercase GitHub username/org):

```bash
LANDSCRAPE_IMAGE_REGISTRY=ghcr.io
LANDSCRAPE_IMAGE_OWNER=your-github-user
LANDSCRAPE_IMAGE_TAG=prod
```

One-time on the VPS (read-only PAT with `read:packages`):

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

## 4. Start (recommended: pull from GHCR)

Images are built in GitHub Actions ([`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml)) on push to `main`. The VPS **pulls** them — no monorepo compile on the server.

```bash
export COMPOSE_FILE=compose.yaml:compose.vps.yml:compose.traefik.yml:compose.registry.yml
```

From your Mac:

```bash
./scripts/deploy-vps.sh sync    # rsync compose + config (not .env)
./scripts/deploy-vps.sh pull      # docker compose pull on VPS
./scripts/deploy-vps.sh up        # docker compose up -d
```

Or `./scripts/deploy-vps.sh fresh` for the full staged command list.

Typical routine deploy after CI finishes: **`sync` → `pull` → `up`** (minutes, not 30–60).

Scoped updates:

| Change | Command |
|--------|---------|
| Web + admin only | `./scripts/deploy-vps.sh up-web` |
| App tier | `./scripts/deploy-vps.sh up-app` |

### Fresh server (after `compose down -v`)

1. Swap: `bash infra/vps/setup-swap.sh`
2. Configure `.env` from `.env.vps.example`
3. `docker login ghcr.io`
4. Staged `pull` + `up` (see `deploy-vps.sh fresh` or below)

```bash
cd /opt/landscrape
export COMPOSE_FILE=compose.yaml:compose.vps.yml:compose.traefik.yml:compose.registry.yml

docker compose pull
docker compose up -d postgres redis minio ollama
docker compose up -d ollama-init keycloak
docker compose up -d mcp-fda mcp-pubmed mcp-clinicaltrials agent api web admin
docker compose up -d worker-scheduler worker-ingest worker-embed worker-enrich worker-reconcile worker-inbound worker-export worker-portal
```

First boot still downloads Ollama models (~2 GB) via `ollama-init`. Avoid `compose down -v` unless you intend to wipe databases and model cache.

Optional **X/social** stack (Puppeteer): build `xactions-api` locally or add a CI job; then `docker compose --profile social up -d`.

### Slow path: build on the VPS (emergency / no CI)

Only when GHCR images are unavailable:

```bash
export COMPOSE_PARALLEL_LIMIT=1
export DOCKER_BUILDKIT=1
COMPOSE_FILE=compose.yaml:compose.vps.yml:compose.traefik.yml \
  docker compose up -d --build
```

Expect **20–45 minutes** on 8 GB RAM. Rebuild a single image when possible (e.g. `docker compose build worker-scheduler` then `up -d` workers).

### Shared images (one build per Dockerfile)

| Image | Built by service | Used by |
|-------|------------------|---------|
| `landscrape-worker` | `worker-scheduler` | all `worker-*` |
| `landscrape-mcp-sidecar` | `mcp-fda` | `mcp-pubmed`, `mcp-clinicaltrials` |
| `landscrape-xactions` | `xactions-api` | `xactions-worker` (`social` profile) |
| `landscrape-agent` | `agent` | `agent-enrich` (optional profile) |
| `landscrape-api`, `landscrape-web`, `landscrape-admin` | same-named services | — |

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

### Redeploy web + admin only (auth / URL fixes)

```bash
./scripts/deploy-vps.sh sync
./scripts/deploy-vps.sh up-web
```

Waits for CI to publish new `landscrape-web` / `landscrape-admin` images when code changed.

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
| `DNS_PROBE_FINISHED_NXDOMAIN` / URL like `e6f7f621c25c:3000` | Wrong URL — use https://deliver-impact.com. Next.js may log `Local: http://<container-id>:3000`; ignore it. Set `WEB_PUBLIC_URL` / `ADMIN_BASE_URL` in `.env` and `./scripts/deploy-vps.sh up-web`. |
| `pull` / `manifest unknown` | Run GitHub Actions `docker-publish` on `main`; set `LANDSCRAPE_IMAGE_OWNER` lowercase; `docker login ghcr.io` |
| OOM during build | Use GHCR pull path instead of `--build` on VPS; if building locally, confirm swap and `COMPOSE_PARALLEL_LIMIT=1` |
| TLS / 404 on domain | Check DNS; Traefik logs: `docker logs traefik-traefik-1` |
| Login fails | Keycloak client secret vs `.env`; realm redirect URIs |
| `intelligence-tools` / `x-twitter` build error | Ensure Dockerfiles build `@landscrape/x-twitter` before `@landscrape/intelligence-tools` |
| Playwright `page.goto` timeouts on competitor sites | Migration `016_render_waituntil_domcontentloaded.sql` runs on fresh DBs; existing DBs: same `UPDATE` as in that file |
| High sustained CPU after deploy | See `.env.vps.example` throttles; `compose.vps.yml` disables `agent-enrich` and optional `--profile social`; `docker stats --no-stream` |
| Stuck ingest / `source_checks` stuck in `running` | `worker-reconcile` clears checks older than 30 minutes; or run the SQL in the signal-pipeline recovery runbook |

## Compose files

| File | Purpose |
|------|---------|
| `compose.yaml` | Base stack; one `build:` per image (worker-scheduler, mcp-fda, …) |
| `compose.vps.yml` | No public ports, CPU/RAM limits, scheduler/Ollama throttles, optional `social` profile |
| `compose.traefik.yml` | HTTPS routing for `web` + `admin` |
| `compose.registry.yml` | Pull from GHCR (no `build` on VPS) |
