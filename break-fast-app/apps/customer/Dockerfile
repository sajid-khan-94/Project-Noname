FROM node:22-alpine AS build
WORKDIR /app/apps/customer

ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY apps/customer/package.json ./package.json
RUN npm install

COPY apps/customer ./
COPY shared /app/shared

RUN npm run build

FROM nginx:1.27-alpine
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/customer /usr/share/nginx/html
EXPOSE 80
