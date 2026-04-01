FROM node:20-slim

# Required for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Volume mount point for SQLite DB
RUN mkdir -p /data

ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/main.js"]
