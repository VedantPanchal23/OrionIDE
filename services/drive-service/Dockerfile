# Build context: repository root
FROM node:18-alpine AS builder
WORKDIR /build
COPY services/drive-service/package*.json ./
RUN npm ci --omit=dev && cp -R node_modules /prod_modules

FROM node:18-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3002
WORKDIR /app
RUN addgroup -S orion && adduser -S orion -G orion -h /home/orion && apk add --no-cache wget
COPY --from=builder /prod_modules ./node_modules
COPY services/drive-service/src ./src
COPY shared /shared
RUN chown -R orion:orion /app /shared
USER orion
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1
CMD ["node", "src/app.js"]
