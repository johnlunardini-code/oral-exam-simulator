#syntax=docker/dockerfile:1

# Minimal, reliable Dockerfile for Railway
FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production --no-audit --no-fund

FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production

# Must copy package.json so Node sees "type": "module"
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

COPY server.js .
COPY knowledge-base.js .
COPY system-prompt.js .
COPY course-specs.json .
COPY public ./public

EXPOSE 3000

# IMPORTANT for Railway:
# Ensure the app starts cleanly and responds to /health
# Railway will use this automatically at:
# Settings → Networking → Healthcheck Path: /health

CMD ["node", "server.js"]
