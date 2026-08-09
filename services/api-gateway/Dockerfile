# Build context: repository root
#   docker build -f services/api-gateway/Dockerfile .
FROM node:18-alpine AS builder
WORKDIR /build
COPY services/api-gateway/package*.json ./
RUN npm ci --omit=dev && cp -R node_modules /prod_modules

FROM node:18-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
RUN addgroup -S orion && adduser -S orion -G orion -h /home/orion && apk add --no-cache wget
COPY --from=builder /prod_modules ./node_modules
COPY services/api-gateway/src ./src
COPY shared /shared
RUN chown -R orion:orion /app /shared
USER orion
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/app.js"]
