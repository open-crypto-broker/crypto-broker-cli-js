## This Dockerfile builds the Crypto Broker CLI JavaScript/TypeScript test application
## This is a simple CLI application that can be used to test the Crypto Broker Server. It is not intended for production use.

ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.24

# Runtime user/group id. Must match the uid that owns the crypto-broker server's
# Unix socket (default 1000, which is also the node image's built-in `node` user).
# Override at build time with --build-arg APP_UID=... / APP_GID=... to line up
# with a server built for a different uid.
ARG APP_UID=1000
ARG APP_GID=1000

## Build stage
# --platform=$BUILDPLATFORM builds on the builder's native architecture; the
# emitted JS bundle is architecture-independent, and buildx pulls the matching
# node runtime for the target platform in the deploy stage.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION} AS builder

ARG COMMIT

WORKDIR /app

# Copy packages and install dependencies
COPY package*.json ./
COPY ../tsconfig.json ./
COPY ../globals.d.ts ./
RUN npm ci

# Copy source code and build + bundle
COPY ../src ./src
RUN npm run build
RUN APP_NAME='js-client-cli' GIT_HASH=$COMMIT npm run esbuild \
    && chmod +x bin/js-client-cli

## Deploy stage
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}

## Bring the runtime uid/gid build args into this stage's scope.
ARG APP_UID
ARG APP_GID

WORKDIR /app

# Upgrade Alpine system packages to patch known vulnerabilities, then remove npm.
# The entrypoint is a self-contained esbuild bundle executed directly by the
# `node` binary; npm is never invoked at runtime. Removing npm strips its bundled
# dependencies from the runtime image so we do not ship tooling the application
# does not need, shrinking the attack surface and the reported vulnerabilities.
RUN apk update && apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm \
              /usr/local/bin/npm \
              /usr/local/bin/npx \
    && rm -rf /var/cache/apk/*

# Copy only the self-contained bundle
COPY --from=builder /app/bin/js-client-cli ./js-client-cli

# Run as a non-root user (default 1000, the node image's built-in `node` user),
# matching the crypto-broker server. The server creates the shared Unix socket
# with mode 0600 owned by APP_UID, so only a process running as that same uid
# (the socket owner) can connect to it.
USER ${APP_UID}:${APP_GID}

# Run the CLI
ENTRYPOINT ["./js-client-cli"]
