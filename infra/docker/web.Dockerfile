FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN --mount=type=cache,target=/root/.npm \
    npm ci
# Workspace package must emit dist/ before Next typecheck (package.json "types": "dist/index.d.ts")
RUN npm run build -w @landscrape/types && npm run build -w @landscrape/auth && npm run build -w @landscrape/session && npm run build -w @landscrape/web

FROM node:20-alpine
WORKDIR /app
# Public URL for redirects: WEB_PUBLIC_URL (not Docker HOSTNAME in startup logs).
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
