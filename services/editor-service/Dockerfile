# Build context: repository root
# Includes python3 + debugpy for DAP (pythonAdapter.js)
FROM node:18-alpine AS builder
WORKDIR /build
COPY services/editor-service/package*.json ./
RUN npm ci --omit=dev && cp -R node_modules /prod_modules

FROM node:18-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3003
ENV ORION_PYTHON=python3
WORKDIR /app
RUN addgroup -S orion && adduser -S orion -G orion -h /home/orion \
  && apk add --no-cache wget python3 py3-pip \
  && pip3 install --no-cache-dir --break-system-packages debugpy \
  && ln -sf /usr/bin/python3 /usr/bin/python
COPY --from=builder /prod_modules ./node_modules
COPY services/editor-service/src ./src
COPY shared /shared
RUN chown -R orion:orion /app /shared
USER orion
EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["node", "src/app.js"]
