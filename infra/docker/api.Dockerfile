FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN --mount=type=cache,target=/root/.npm \
    npm ci
RUN npm run build -w @landscrape/types && npm run build -w @landscrape/config && npm run build -w @landscrape/auth && npm run build -w @landscrape/db && npm run build -w @landscrape/crypto && npm run build -w @landscrape/jobs && npm run build -w @landscrape/mcp-client && npm run build -w @landscrape/x-twitter && npm run build -w @landscrape/intelligence-tools && npm run build -w @landscrape/ai && npm run build -w @landscrape/api

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@landscrape/api"]
