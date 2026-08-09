# Build context: repository root
FROM node:18-alpine AS builder
WORKDIR /build
COPY services/execution-service/package*.json ./
RUN npm ci --omit=dev && cp -R node_modules /prod_modules

FROM node:18-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3004
WORKDIR /app
RUN addgroup -S orion && adduser -S orion -G orion -h /home/orion && apk add --no-cache wget
COPY --from=builder /prod_modules ./node_modules
COPY services/execution-service/src ./src
COPY shared /shared
RUN chown -R orion:orion /app /shared
USER orion
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3004/health || exit 1
CMD ["node", "src/app.js"]
