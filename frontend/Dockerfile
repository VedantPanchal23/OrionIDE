# ── Stage 1: Build React app ─────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY public/ ./public/
COPY src/ ./src/

ENV GENERATE_SOURCEMAP=false
RUN npm run build

# ── Stage 2: Serve with nginx ───────────────────────────────────────────
FROM nginx:alpine

# Non-root setup
RUN addgroup -S orion && adduser -S orion -G orion

# Copy custom nginx config for SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

# Set ownership
RUN chown -R orion:orion /usr/share/nginx/html && \
    chown -R orion:orion /var/cache/nginx && \
    chown -R orion:orion /var/log/nginx && \
    touch /var/run/nginx.pid && chown orion:orion /var/run/nginx.pid

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
