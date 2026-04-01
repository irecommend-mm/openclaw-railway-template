FROM node:22-bookworm

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gosu \
    procps \
    python3 \
    build-essential \
    zip \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@2026.3.28 clawhub@latest

# Install a modern Go toolchain (Debian bookworm golang-go is too old for
# modules that use patch-style go directives like `go 1.25.5`).
ARG GO_VERSION=1.25.1
RUN curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -o /tmp/go.tgz \
  && rm -rf /usr/local/go \
  && tar -C /usr/local -xzf /tmp/go.tgz \
  && rm -f /tmp/go.tgz
ENV PATH="/usr/local/go/bin:${PATH}"

# meta-cli (Facebook Pages CLI)
RUN go install github.com/ygncode/meta-cli/cmd/meta@latest \
  && install -m 0755 /root/go/bin/meta /usr/local/bin/meta-cli

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY src ./src
COPY skills ./skills
COPY --chmod=755 entrypoint.sh ./entrypoint.sh

RUN useradd -m -s /bin/bash openclaw \
  && chown -R openclaw:openclaw /app \
  && mkdir -p /data && chown openclaw:openclaw /data

# Install gogcli binary directly
RUN curl -fsSL https://github.com/steipete/gogcli/releases/download/latest/gogcli-linux-amd64 -o /tmp/gogcli \
  && chmod +x /tmp/gogcli \
  && install -m 0755 /tmp/gogcli /usr/local/bin/gog \
  && rm -f /tmp/gogcli

ENV PORT=8080
ENV OPENCLAW_ENTRY=/usr/local/lib/node_modules/openclaw/dist/entry.js
# Persist these via Railway Volume mounted at /data (see README)
ENV OPENCLAW_STATE_DIR=/data/.openclaw
ENV OPENCLAW_WORKSPACE_DIR=/data/workspace
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:8080/setup/healthz || exit 1

USER root
ENTRYPOINT ["./entrypoint.sh"]
