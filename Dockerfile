FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG COMMIT_SHA=dev
ENV NODE_ENV=production
ENV NEXT_PUBLIC_COMMIT_SHA=$COMMIT_SHA
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app && \
    apk add --no-cache wget
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
# Copy migration script and entrypoint
COPY --from=builder /app/scripts/migrate-to-multitenancy.js ./scripts/
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/
USER root
RUN chmod +x ./scripts/docker-entrypoint.sh
USER app
EXPOSE 3000
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
