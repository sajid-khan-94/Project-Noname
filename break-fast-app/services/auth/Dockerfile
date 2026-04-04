FROM node:22-alpine
WORKDIR /app

COPY services/auth/package.json ./package.json
COPY server ./server
COPY services ./services

EXPOSE 8081
CMD ["node", "services/auth/server.js"]
