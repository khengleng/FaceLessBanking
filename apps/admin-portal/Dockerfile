FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @faceless-banking/admin-portal build

FROM nginx:1.27-alpine
COPY --from=builder /app/apps/admin-portal/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
