# Stage 1: Build TypeScript to JavaScript
FROM node:22 AS builder

WORKDIR /app

# Copy package and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY .. .
RUN npm run build

# Stage 2: Run the built JS
FROM node:22-alpine

WORKDIR /app

# Copy only built output and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies (use the ignore to skip husky)
RUN npm ci --omit=dev --ignore-scripts

# Run the CLI
ENTRYPOINT ["node", "dist/cli.js"]
