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
# Copy source code and build
COPY .. .
RUN npm run build

## Deploy stage
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}

WORKDIR /app

# Copy only built output and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies (use the ignore to skip husky)
RUN npm ci --omit=dev --ignore-scripts

# Run the CLI
ENTRYPOINT ["node", "dist/cli.js"]
