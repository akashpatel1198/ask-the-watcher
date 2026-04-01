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
  curl -L --fail "$DB_DOWNLOAD_URL" -o "$DB_FILE.zip"
  unzip -p "$DB_FILE.zip" "*.db" > "$DB_FILE" || unzip "$DB_FILE.zip" -d /data
  rm "$DB_FILE.zip"
  echo "Download complete."
fi

exec node dist/main.js
