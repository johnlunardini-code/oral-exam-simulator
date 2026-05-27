#syntax=docker/dockerfile:1

FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production --no-audit --no-fund

FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

COPY server.js .
COPY knowledge-base.js .
COPY system-prompt.js .
COPY course-specs.json .
COPY public ./public

EXPOSE 3000

CMD ["node", "server.js"]