# Ask the Watcher

A custom Marvel API that scrapes data from the [Marvel Database](https://marvel.fandom.com/) wiki and serves it through a REST API.

The official Marvel API is limited and frustrating to work with. This project pulls character, comic, team, event, and series data from the Marvel fandom wiki via its MediaWiki API, stores it in a local SQLite database, and exposes it through a documented REST API with API key auth and rate limiting.

## Tech Stack

- Node.js (ESM) + TypeScript
- NestJS (REST API framework)
- SQLite via better-sqlite3
- Swagger (API docs)
- Resend (email delivery for API key signup)
- axios + cheerio (wiki scraping)
- Docker

## Live Version

Hosted at: `` (Not Hosted Yet, Coming Soon)

Sign up for an API key at `POST /api/auth/signup` with your email. You'll get a key sent to your inbox. Include it as the `x-api-key` header on all requests. Swagger docs are available at `/api/docs`.

Free tier gets 10,000 requests/day. Keys cannot be recovered, so save yours somewhere safe.

## Local Development Setup

### Prerequisites

- Node.js 20+
- npm
- A populated `marvel.db` SQLite database file (see [Database Setup](#database-setup) below)

### Install and Run

```bash
git clone https://github.com/akashpatel1198/ask-the-watcher.git
cd ask-the-watcher
npm install
cp .env.example .env
# fill in .env values (see below)

npm run build
npm start
# or build + run in one step:
npm run start:dev
```

The API starts at `http://localhost:3000`. Swagger docs at `http://localhost:3000/api/docs`.

### Environment Variables

```bash
# Server
PORT=3000                          # API server port (default: 3000)
DB_PATH=./data/marvel.db           # Path to SQLite database file (default: ./data/marvel.db)

# Email (optional, signup emails won't send without these)
RESEND_API_KEY=re_xxxxxxxxxxxx     # API key from https://resend.com
EMAIL_FROM=noreply@yourdomain.com  # Sender address (must be verified in Resend)
OWNER_EMAIL=you@example.com        # Gets notified when someone signs up for an API key
```

### Docker

```bash
docker build -t ask-the-watcher .
docker run -p 3000:3000 -v /path/to/data:/data ask-the-watcher
```

Mount a volume at `/data` containing your `marvel.db` file.

## Database Setup

The database is built by running scraping scripts against the Marvel fandom wiki, then seeding the results into SQLite. The scrape output JSON files are gitignored, so you need to run these yourself.

```bash
# 1. Scrape data from the wiki (writes JSON to scripts/data/)
node scripts/scrape-characters.js
node scripts/scrape-comics.js
node scripts/scrape-series.js
node scripts/scrape-teams.js
node scripts/scrape-events.js

# 2. Create the database schema
node scripts/setup-db.js

# 3. Seed entity tables from scraped JSON
node scripts/seed-entities.js

# 4. Seed join/relationship tables
node scripts/seed-joins.js
```

This takes a while. The scrape scripts have built-in rate limiting and retry logic. The resulting database is ~265MB.

To create an API key manually (without email):

```bash
node scripts/create-api-key.js
```

## Project Structure

```
src/                  # NestJS API
  main.ts             # Entry point, Swagger setup
  app.module.ts       # Root module
  auth/               # API key guard, signup, rate limiting
  characters/         # /api/characters endpoints
  comics/             # /api/comics endpoints
  series/             # /api/series endpoints
  teams/              # /api/teams endpoints
  events/             # /api/events endpoints
  database/           # SQLite connection service

scripts/              # Scraping and DB setup
  scrape-*.js         # Full scrape scripts per entity type
  setup-db.js         # Schema creation
  seed-entities.js    # Entity table seeding
  seed-joins.js       # Join table seeding
  create-api-key.js   # Manual key generation
  discovery/          # Early exploration scripts
  enumerate/          # Wiki page enumeration

lib/                  # Shared utilities
  db.js               # SQLite client
  scraper-utils.js    # Wikitext parsing, image resolution, scraper helpers

schema/               # JSON schema definitions for all tables
data/                 # SQLite database (gitignored)
```

## API Endpoints

All endpoints require `x-api-key` header unless marked public.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Request an API key (public) |
| GET | `/api/characters` | List characters (filterable by name, alias, origin, gender) |
| GET | `/api/characters/:id` | Get character by ID |
| GET | `/api/characters/:id/teams` | Teams a character belongs to |
| GET | `/api/characters/:id/events` | Events a character appeared in |
| GET | `/api/characters/:id/comics` | Comics a character appeared in |
| GET | `/api/comics` | List comics (filterable by year, writer, series) |
| GET | `/api/comics/:id` | Get comic by ID |
| GET | `/api/comics/:id/characters` | Characters in a comic |
| GET | `/api/series` | List series |
| GET | `/api/series/:id` | Get series by ID |
| GET | `/api/teams` | List teams (filterable by name, status, reality) |
| GET | `/api/teams/:id` | Get team by ID |
| GET | `/api/teams/:id/members` | Members of a team |
| GET | `/api/events` | List events (filterable by name, reality) |
| GET | `/api/events/:id` | Get event by ID |
| GET | `/api/events/:id/characters` | Characters in an event |
| GET | `/api/events/:id/comics` | Comics in an event |

All list endpoints support `page` and `limit` query params (default 20, max 100).

## Rate Limits

- 100 requests/minute per API key
- 1,000 requests/minute globally
- 10,000 requests/day (free tier) or 100,000/day (paid tier)
- 3 signup requests/hour per IP
