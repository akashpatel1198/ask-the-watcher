# Ask the Watcher

A custom Marvel API built by scraping data from the [Marvel Database](https://marvel.fandom.com/) wiki.

The official Marvel API is limited and frustrating to work with. This project pulls character, comic, team, and event data from the Marvel fandom wiki (via its MediaWiki API), stores it in a relational database, and exposes it through a clean REST API.

## Status

**Currently in the Discovery phase.** Exploring what data the wiki provides for each entity type before designing the database schema. See [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) for the full plan.

## Data Source

All data comes from `marvel.fandom.com/api.php` (the MediaWiki API). No HTML scraping. The API returns structured JSON and doesn't require authentication.

## Entities

| Entity | Wiki Pages | Notes |
|---|---|---|
| Characters | ~98,500 | Will be filtered down to notable characters |
| Comics | ~70,400 | May track series rather than every individual issue |
| Events | ~384 | Small enough to keep all |
| Teams | ~6,700 | Mostly manageable |

## Tech Stack

- **Runtime:** Node.js (ESM)
- **Data fetching:** axios
- **Database:** Supabase (Postgres)
- **API:** NestJS + Swagger

## Project Structure

```
scripts/
  discovery/        # Phase 1: explore and sample wiki data
    character/      # Character sampling scripts + output
    case-study/     # Deep dives on specific pages
    pre-testing/    # Early exploration (category counts, field frequency)
  scrape-*.js       # Full scrape scripts (later phases)
  seed-db.js        # DB seeding script
lib/                # Shared utilities (supabase client, etc.)
src/                # NestJS API (later phases)
```

## Running Discovery Scripts

```bash
npm install

# category page counts
node scripts/discovery/pre-testing/category-counts.js

# fetch sample character data for 9 well-known characters
node scripts/discovery/character/fetch-sample.js
```

Output goes to `output/` folders (gitignored).

## License

ISC
