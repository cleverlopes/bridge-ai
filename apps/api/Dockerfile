FROM oven/bun:1.2.22 AS builder

WORKDIR /app

# Install dependencies (monorepo root)
COPY package.json bun.lock nx.json tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages ./packages

RUN bun install --frozen-lockfile

# Build API (webpack)
RUN bun run api:build


FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Runtime artifacts
COPY --from=builder /app/dist/apps/api ./dist/apps/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/apps/api/main.js"]

