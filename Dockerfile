#syntax=docker/dockerfile:1

# === Build stage: Install dependencies ===
FROM dhi.io/node:18-alpine-dev AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --production --no-audit --no-fund

# === Final stage: Create minimal runtime image ===
FROM dhi.io/node:18-alpine-dev

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=node:node /app/node_modules /app/node_modules
COPY --chown=node:node . .

EXPOSE 3000

ENTRYPOINT []
CMD ["node", "server.js"]
