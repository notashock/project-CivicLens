# ==============================================================================
# CivicTrace Unified Full-Stack Application Container
# Hosts both FastAPI Core Backend and Next.js 15 PWA Frontend
# Includes built-in supervisor, signal management, and health maintenance
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Node.js TypeScript Packages & Next.js Frontend
# ------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS node-builder
WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY packages/digipin/package.json ./packages/digipin/
COPY packages/crypto-nullifier/package.json ./packages/crypto-nullifier/
COPY packages/sanitization-worker/package.json ./packages/sanitization-worker/
COPY apps/web/package.json ./apps/web/

# Install monorepo dependencies
RUN npm ci

# Copy TypeScript configs and source code
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# Build TypeScript packages & Next.js production bundle
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspaces

# ------------------------------------------------------------------------------
# Stage 2: Build Python Dependencies Wheelhouse
# ------------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS python-builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r ./requirements.txt

# ------------------------------------------------------------------------------
# Stage 3: Unified Production Runtime Image
# ------------------------------------------------------------------------------
FROM python:3.11-slim-bookworm AS runner
WORKDIR /app

# Install Node.js 22 runtime, curl for health checks, and postgresql client libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    ca-certificates \
    libpq5 \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy pre-built Python dependencies
COPY --from=python-builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV API_PORT=8000
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=192"
ENV MALLOC_ARENA_MAX=2
ENV UV_THREADPOOL_SIZE=2
ENV API_WORKERS=1

# Copy built monorepo packages, node_modules, and web bundle
COPY --from=node-builder /app/package.json /app/package.json
COPY --from=node-builder /app/node_modules /app/node_modules
COPY --from=node-builder /app/packages /app/packages
COPY --from=node-builder /app/apps/web /app/apps/web
COPY apps/api /app/apps/api
COPY scripts /app/scripts

# Fix execution permissions and ensure Unix LF endings
RUN sed -i 's/\r$//' /app/scripts/docker-entrypoint.sh /app/scripts/docker-healthcheck.sh && \
    chmod +x /app/scripts/docker-entrypoint.sh /app/scripts/docker-healthcheck.sh

# Expose Next.js Web port (Render dynamically provides PORT at runtime, default 3000)
EXPOSE 3000

# Continuous Healthcheck & Lifecycle Maintenance
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
    CMD /app/scripts/docker-healthcheck.sh

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
