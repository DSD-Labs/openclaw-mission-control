# Build
FROM node:22-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json /app/
RUN npm ci

COPY frontend/ /app/

# Build static site
RUN npm run build

# Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config provided by top-level compose (mounted)
EXPOSE 80
