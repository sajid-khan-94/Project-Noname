FROM node:22-alpine
WORKDIR /app

COPY services/gateway/package.json ./package.json
COPY server ./server
COPY services ./services

EXPOSE 8080
CMD ["node", "services/gateway/server.js"]
