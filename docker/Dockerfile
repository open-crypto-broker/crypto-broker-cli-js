## This Dockerfile builds the Crypto Broker CLI JavaScript/TypeScript test application
## This is a simple CLI application that can be used to test the Crypto Broker Server. It is not intended for production use.

ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.23

## Build stage
FROM node:${NODE_VERSION} AS builder

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

WORKDIR /app

# Upgrade Alpine system packages to patch known vulnerabilities
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# Copy only the self-contained bundle
COPY --from=builder /app/bin/js-client-cli ./js-client-cli

# Run the CLI
ENTRYPOINT ["./js-client-cli"]
