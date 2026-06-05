FROM node:20-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/ ./

EXPOSE 8080

CMD ["node", "index.js"]
