FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./. 
COPY services ./services
COPY packages ./packages
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @faceless-banking/rbac-service build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/services/rbac-service ./services/rbac-service
COPY --from=builder /app/packages ./packages
RUN corepack enable && pnpm install --filter @faceless-banking/rbac-service...
EXPOSE 3000
CMD ["node", "--import", "tsx", "services/rbac-service/src/index.ts"]
