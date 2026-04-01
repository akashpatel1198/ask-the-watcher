FROM node:20-slim

# Required for better-sqlite3 native compilation + curl for DB download
RUN apt-get update && apt-get install -y python3 make g++ curl unzip && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN mkdir -p /data

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# cache bust: v2

ENV NODE_ENV=production

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
