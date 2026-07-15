FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm db:generate \
  && pnpm --filter api build \
  && pnpm --filter api deploy --prod --legacy /runtime \
  && cp -R apps/api/dist /runtime/dist \
  && mkdir -p /runtime/scripts \
  && cp scripts/validate-runtime-env.cjs /runtime/scripts/validate-runtime-env.cjs

FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /runtime /app
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD node -e "fetch('http://127.0.0.1:3001/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node scripts/validate-runtime-env.cjs api && node dist/main.js"]
