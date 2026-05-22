# -- Stage 1: Builder --
FROM node:18-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /prod_modules

# -- Stage 2: Runner --
FROM node:18-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install build tools needed by node-pty at runtime + common dev tools
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    git curl wget \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system orion && adduser --system --ingroup orion orion

COPY --from=builder /prod_modules ./node_modules
COPY src/ ./src/

# Create workspace directory for user projects
RUN mkdir -p /workspace && chown -R orion:orion /workspace
RUN chown -R orion:orion /app

USER orion
EXPOSE 3007

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3007/health || exit 1

CMD ["node", "src/app.js"]
