# Stage 1: Build frontend
FROM node:20-alpine AS build

WORKDIR /app

# Accept build args
ARG ADMIN_PATH=/manage-admin

COPY package*.json ./
RUN npm ci

COPY . .

# Inject ADMIN_PATH at build time
ENV ADMIN_PATH=${ADMIN_PATH}
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built frontend
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
