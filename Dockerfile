FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY public/ ./public/

ENV NODE_ENV=production
ENV PORT=7000

EXPOSE 7000
CMD ["node", "src/server.js"]
