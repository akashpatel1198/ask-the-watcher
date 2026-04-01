#!/bin/sh
set -e

DB_FILE=/data/marvel.db

if [ ! -f "$DB_FILE" ]; then
  if [ -z "$DB_DOWNLOAD_URL" ]; then
    echo "ERROR: DB_DOWNLOAD_URL is not set and no database found at $DB_FILE"
    exit 1
  fi
  echo "Downloading marvel.db..."
  mkdir -p /data
  curl -L --fail "$DB_DOWNLOAD_URL" -o /data/marvel.db.zip
  unzip -o /data/marvel.db.zip -d /data
  rm /data/marvel.db.zip
  echo "Download complete."
fi

exec node dist/main.js
