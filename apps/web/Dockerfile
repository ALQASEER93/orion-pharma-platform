FROM node:24-alpine AS builder
WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/web ./apps/web
RUN pnpm install --filter @orion/web... --frozen-lockfile=false
RUN pnpm --filter @orion/web build

FROM node:24-alpine AS runner
WORKDIR /workspace
RUN corepack enable

COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/web ./apps/web

EXPOSE 3000
CMD ["pnpm", "--filter", "@orion/web", "start"]
