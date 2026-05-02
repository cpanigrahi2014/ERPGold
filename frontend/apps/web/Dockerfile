# ---------- 1) React build ----------
FROM node:20-alpine AS build
WORKDIR /app/apps/web
ENV CI=true

# Install deps with stable cache key first
COPY apps/web/package.json ./
RUN npm install --no-audit --no-fund --loglevel=error

# App sources
COPY apps/web ./

RUN npm run build

# ---------- 2) Runtime ----------
FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/_proxy.inc /etc/nginx/conf.d/_proxy.inc
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
