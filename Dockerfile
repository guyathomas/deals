FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN cd web && npm ci && npm run build

EXPOSE 3001
CMD ["node", "src/index.js", "serve", "-p", "3001"]
