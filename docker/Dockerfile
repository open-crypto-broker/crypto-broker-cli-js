# Stage 1: Build TypeScript to JavaScript
FROM node:22 AS builder

WORKDIR /app

# Copy packages, npm config and install dependencies
COPY package*.json ./
COPY .npmrc ./
RUN --mount=type=secret,id=git_npm_token,env=NODE_AUTH_TOKEN \
    npm --verbose ci
# Copy source code and build
COPY .. .
RUN npm run build

# Stage 2: Run the built JS
FROM node:22-alpine

WORKDIR /app

# Copy only built output, config and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.npmrc ./

# Install only production dependencies (use the ignore to skip husky)
RUN --mount=type=secret,id=git_npm_token,env=NODE_AUTH_TOKEN \
    npm ci --omit=dev --ignore-scripts

# Run the CLI
ENTRYPOINT ["node", "dist/cli.js"]
