FROM node:22-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
COPY packages/webina-ui /packages/webina-ui
# Materialize file: dep inside node_modules so webpack resolves peers (recharts) from /app
RUN npm ci \
  && rm -rf node_modules/@webina/ui \
  && mkdir -p node_modules/@webina \
  && cp -a /packages/webina-ui node_modules/@webina/ui

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ ./
ARG API_PROXY_TARGET=http://panel-api:8080
ARG AGENT_WS_TARGET=http://panel-agent:9091
ARG PHPMYADMIN_PROXY_TARGET=http://panel-phpmyadmin:80
ARG PHPPGADMIN_PROXY_TARGET=http://panel-phppgadmin:80
ARG ROUNDCUBE_PROXY_TARGET=http://panel-roundcube:80
ENV NEXT_TELEMETRY_DISABLED=1
ENV API_PROXY_TARGET=$API_PROXY_TARGET
ENV AGENT_WS_TARGET=$AGENT_WS_TARGET
ENV PHPMYADMIN_PROXY_TARGET=$PHPMYADMIN_PROXY_TARGET
ENV PHPPGADMIN_PROXY_TARGET=$PHPPGADMIN_PROXY_TARGET
ENV ROUNDCUBE_PROXY_TARGET=$ROUNDCUBE_PROXY_TARGET
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
