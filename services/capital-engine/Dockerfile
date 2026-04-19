FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/capital-engine/package.json ./services/capital-engine/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json

RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @faceless-banking/capital-engine build

EXPOSE 3000
CMD ["pnpm", "--filter", "@faceless-banking/capital-engine", "exec", "node", "--import", "tsx", "src/index.ts"]
