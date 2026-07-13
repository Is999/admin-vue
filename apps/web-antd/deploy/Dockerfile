# syntax=docker/dockerfile:1.7

FROM node:22-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_OPTIONS=--max-old-space-size=8192
ENV TZ=Asia/Shanghai
ENV CI=true

RUN npm install --global corepack \
    && corepack enable

WORKDIR /app

COPY . /app

RUN --mount=type=cache,id=admin-vue-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --package-import-method=copy
RUN --mount=type=secret,id=admin-vue-env,target=/app/apps/web-antd/.env.production.local,required=true \
    pnpm --filter @vben/web-antd run build

FROM nginx:stable-alpine AS production

RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /app/apps/web-antd/dist /usr/share/nginx/html
COPY apps/web-antd/deploy/nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
