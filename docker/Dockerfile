## This Dockerfile builds the Crypto Broker CLI JavaScript/TypeScript test application
## This is a simple CLI application that can be used to test the Crypto Broker Server. It is not intended for production use.

ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.23

## Build stage
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Copy packages and install dependencies
COPY package*.json ./
RUN npm ci
# Copy source code and build + bundle
COPY .. .
RUN npm run build \
    && npx esbuild dist/cli.js --bundle --platform=node --outfile=bin/js-client-cli --format=cjs \
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
