FROM node:20-alpine AS base
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && cp -r node_modules prod_node_modules
RUN npm ci

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─── Production image ─────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/prod_node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
