FROM node:22-alpine
WORKDIR /app

COPY services/payment/package.json ./package.json
COPY server ./server
COPY services ./services

EXPOSE 8082
CMD ["node", "services/payment/server.js"]
