# ── Stage 1: Builder ──────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /build

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /prod_modules

# ── Stage 2: Runner ──────────────────────────────────────────────────────
FROM node:18-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Non-root user
RUN addgroup -S orion && adduser -S orion -G orion -h /home/orion

# Copy production dependencies
COPY --from=builder /prod_modules ./node_modules

# Copy application source
COPY src/ ./src/

# Set ownership
RUN chown -R orion:orion /app
USER orion

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]
