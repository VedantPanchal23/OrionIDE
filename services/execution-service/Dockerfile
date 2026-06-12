# -- Stage 1: Builder --
FROM node:18-alpine AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /prod_modules

# -- Stage 2: Runner --
FROM node:18-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S orion && adduser -S orion -G orion -h /home/orion
COPY --from=builder /prod_modules ./node_modules
COPY src/ ./src/
RUN chown -R orion:orion /app
USER orion
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3004/health || exit 1
CMD ["node", "src/app.js"]
