# Multi-stage production build for CivicTrace Next.js 15 Frontend
FROM node:20-alpine AS base

WORKDIR /app

# Dependencies Stage
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/digipin/package.json ./packages/digipin/
COPY packages/crypto-nullifier/package.json ./packages/crypto-nullifier/
COPY packages/sanitization-worker/package.json ./packages/sanitization-worker/
COPY apps/web/package.json ./apps/web/

RUN npm ci

# Builder Stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspaces

# Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@civictrace/web"]
