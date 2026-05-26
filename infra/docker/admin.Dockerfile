FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN --mount=type=cache,target=/root/.npm \
    npm ci
RUN npm run build -w @landscrape/types && npm run build -w @landscrape/auth && npm run build -w @landscrape/session && npm run build -w @landscrape/admin

FROM node:20-alpine
WORKDIR /app
# Public URL for redirects: ADMIN_BASE_URL (not Docker HOSTNAME in startup logs).
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /app/apps/admin/public ./apps/admin/public
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
