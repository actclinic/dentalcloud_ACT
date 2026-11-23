# syntax=docker/dockerfile:1.7

################################################################################
# Production Docker image for DentalCloud (Vite + React static application)
#
# Build example:
#   docker build --build-arg AI_API_KEY=your_key -t dentalcloud:prod .
#
# Run with the production resource and security limits in compose.production.yml.
#
# Note: Vite embeds client-side environment values at build time. Do not pass
# secrets that must remain private to AI_API_KEY or other frontend build args.
################################################################################

FROM node:22-alpine AS deps

WORKDIR /app

# Install dependencies in a separate layer for better build caching.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --include=dev --no-audit --no-fund


FROM node:22-alpine AS build

WORKDIR /app

ENV NODE_ENV=production \
    CI=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Vite reads this value during build via vite.config.ts.
ARG AI_API_KEY=
ENV AI_API_KEY=${AI_API_KEY}

RUN npm run build


FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

ENV NODE_ENV=production \
    NGINX_PORT=8081

COPY --chown=101:101 --from=build /app/dist /usr/share/nginx/html

USER root

RUN cat > /etc/nginx/nginx.conf <<'EOF'
worker_processes 1;
worker_rlimit_nofile 4096;

error_log /dev/stderr warn;
pid /tmp/nginx.pid;

events {
    worker_connections 1024;
    multi_accept off;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /dev/stdout main;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 15;
    keepalive_requests 1000;
    reset_timedout_connection on;
    client_body_timeout 10;
    client_header_timeout 10;
    send_timeout 10;

    # All nginx runtime state stays in /tmp so the root filesystem can be read-only.
    client_body_temp_path /tmp/client_temp;
    proxy_temp_path /tmp/proxy_temp;
    fastcgi_temp_path /tmp/fastcgi_temp;
    uwsgi_temp_path /tmp/uwsgi_temp;
    scgi_temp_path /tmp/scgi_temp;

    include /etc/nginx/conf.d/*.conf;
}
EOF

RUN cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
    listen 8081;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    server_tokens off;

    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/json
        application/xml
        application/rss+xml
        image/svg+xml;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(self), microphone=(), geolocation=()" always;

    location = /health {
        access_log off;
        default_type text/plain;
        return 200 "ok\n";
    }

    # Same-origin gateway to the existing Supabase backend. This prevents
    # browser CORS preflights from depending on the backend's CDN proxy while
    # keeping the database and all Supabase services on their current server.
    location /supabase/ {
        proxy_pass https://167.86.78.69/;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_ssl_name supabaseact.dentalcloud.asia;
        proxy_ssl_verify on;
        proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
        proxy_ssl_verify_depth 3;
        proxy_set_header Host supabaseact.dentalcloud.asia;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_connect_timeout 5s;
        proxy_read_timeout 3600s;
        proxy_send_timeout 60s;
    }

    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        try_files $uri =404;
    }

    location ~* \.(?:js|css|mjs|png|jpg|jpeg|gif|ico|svg|webp|avif|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable" always;
        try_files $uri =404;
    }

    # Client-side routing fallback for the Vite single-page application.
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Prevent the base-image entrypoint from replacing our configuration or trying
# to write under /etc/nginx when the production root filesystem is read-only.
RUN rm -rf /etc/nginx/templates

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8081/health || exit 1

USER 101

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]