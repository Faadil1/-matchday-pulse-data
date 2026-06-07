# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx:alpine's entrypoint runs envsubst on *.conf.template files,
# substituting ${PORT} with the Cloud Run-injected value before nginx starts.
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080
