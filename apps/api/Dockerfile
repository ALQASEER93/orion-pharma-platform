FROM node:24-alpine AS builder
WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @orion/api... --frozen-lockfile=false

COPY apps/api ./apps/api
RUN pnpm --filter @orion/api prisma generate
RUN pnpm --filter @orion/api build

FROM node:24-alpine AS runner
WORKDIR /workspace
RUN corepack enable

COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/api ./apps/api

EXPOSE 3001
CMD ["sh", "-c", "pnpm --filter @orion/api prisma:deploy && pnpm --filter @orion/api start:prod"]
