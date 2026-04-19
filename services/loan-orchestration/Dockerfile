FROM node:22-alpine AS base

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services ./services
COPY packages ./packages
COPY tsconfig.base.json ./
COPY .eslintrc.cjs ./

RUN pnpm install --frozen-lockfile

WORKDIR /app/services/loan-orchestration
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js"]
