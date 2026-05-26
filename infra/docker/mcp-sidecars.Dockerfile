FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
RUN --mount=type=cache,target=/root/.npm \
    npm ci
RUN npm run build -w @landscrape/mcp-sidecars

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app
EXPOSE 4020
CMD ["npm", "run", "start", "-w", "@landscrape/mcp-sidecars"]
