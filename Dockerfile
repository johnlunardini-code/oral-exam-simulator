FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production --no-audit --no-fund

FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY server.js .
COPY knowledge-base.js .
COPY system-prompt.js .
COPY course-specs.json .
COPY public ./public

EXPOSE 3000

# Healthcheck that respects whatever PORT Railway assigns (8080, 3000, etc.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=12s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000; require('http').get('http://127.0.0.1:'+p+'/health', r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
