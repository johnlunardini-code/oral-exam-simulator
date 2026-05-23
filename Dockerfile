#syntax=docker/dockerfile:1

# === Build stage: Install dependencies ===
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-audit --no-fund

# === Final stage: Create minimal runtime image ===
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/node_modules /app/node_modules
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
