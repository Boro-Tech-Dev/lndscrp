# Build on slim Node — avoids snapshotting the full Playwright image during `npm run build`
# (Docker Desktop often hits EIO on huge overlay writes). Runtime uses the official Playwright image.
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN --mount=type=cache,target=/root/.npm \
    npm ci
RUN npm run build -w @landscrape/types && npm run build -w @landscrape/config && npm run build -w @landscrape/db && npm run build -w @landscrape/crypto && npm run build -w @landscrape/jobs && npm run build -w @landscrape/mcp-client && npm run build -w @landscrape/x-twitter && npm run build -w @landscrape/intelligence-tools && npm run build -w @landscrape/product-enrichment && npm run build -w @landscrape/ai && npm run build -w @landscrape/worker

FROM mcr.microsoft.com/playwright:v1.59.1-noble
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=build /app /app
CMD ["npm", "run", "start", "-w", "@landscrape/worker"]
