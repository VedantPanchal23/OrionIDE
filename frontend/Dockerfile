# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Frontend (Vite production build → nginx)
# Build: docker build -f frontend/Dockerfile frontend/
# Compose: service "frontend" in root docker-compose.yml
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

ENV NODE_ENV=production
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache wget

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --retries=5 --start-period=10s \
  CMD wget -qO- http://127.0.0.1:80/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
