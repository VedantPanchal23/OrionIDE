# ─────────────────────────────────────────────────────────────────────────────
# Orion IDE — Terminal service (needs native node-pty + shell tools)
# Build context: repository root
# Keep tooling roughly aligned with Dockerfile.dev (polyglot sandbox).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:18-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY services/terminal-service/package*.json ./
RUN npm ci --omit=dev && cp -R node_modules /prod_modules

FROM node:18-slim AS runner
ENV NODE_ENV=production
ENV PORT=3007
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ \
    git curl wget ca-certificates gnupg \
    golang-go \
    openjdk-17-jdk-headless \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && corepack enable \
    && (curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg) \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:${PATH}
RUN set -eux; \
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh; \
    sh /tmp/rustup-init.sh -y --no-modify-path --default-toolchain stable --profile minimal; \
    rm /tmp/rustup-init.sh; \
    chmod -R a+rx /usr/local/cargo /usr/local/rustup; \
    rustc --version; \
    cargo --version

RUN addgroup --system orion && adduser --system --ingroup orion --home /home/orion orion

COPY --from=builder /prod_modules ./node_modules
COPY services/terminal-service/src ./src
COPY shared /shared

RUN mkdir -p /workspace \
  && chown -R orion:orion /workspace /app /shared

# PTY / git often need write access; run as orion
USER orion
EXPOSE 3007

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3007/health || exit 1

CMD ["node", "src/app.js"]
