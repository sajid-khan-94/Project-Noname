FROM node:22-alpine
WORKDIR /app

COPY services/finance/package.json ./package.json
COPY server ./server
COPY services ./services

EXPOSE 8083
CMD ["node", "services/finance/server.js"]
