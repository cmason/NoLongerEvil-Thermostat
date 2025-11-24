FROM node:24-alpine

WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/dist .

WORKDIR /app

EXPOSE 80 443 8081

CMD ["node", "server/index.js"]