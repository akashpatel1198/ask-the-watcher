# Marvel Wiki Scraper — Project Roadmap

## Tech Stack

| Layer | Tool |
|---|---|
| Language | Node.js (ESM) |
| Scraping | `axios` + `cheerio` |
| Database | Supabase (Hobby Tier) |
| API Framework | NestJS |
| API Docs | `@nestjs/swagger` (Swagger UI) |
| Auth | API Key (via NestJS Guard) |

---

## Data Entities

The following entities will be scraped, stored, and exposed via the API:

- **Characters** — across all universes (Earth-616, Ultimate, etc.)
- **Comics / Issues**
- **Teams / Groups**
- **Story Events**

> ⚠️ **Disclaimer:** Exact data shapes, fields, and relationships are not yet defined. What gets stored per entity — and how entities relate to each other — will be determined during Phase 1 after exploring the wiki's actual HTML structure and seeing what data is reliably available. Schema design in Phase 2 will be driven by those findings, not assumptions.

---

## Project Structure

```
/
├── scripts/           # Local-only scraping + seeding scripts (never exposed)
│   ├── scrape-characters.js
│   ├── scrape-comics.js
│   ├── scrape-teams.js
│   ├── scrape-events.js
│   └── seed-db.js
├── data/              # JSON output from scrape scripts (precursor to DB)
│   ├── characters.json
│   ├── comics.json
│   ├── teams.json
│   └── events.json
├── src/               # NestJS API
│   ├── characters/
│   ├── comics/
│   ├── teams/
│   ├── events/
│   └── main.ts
├── .env
└── ROADMAP.md
```

---

## Phase 1 — Scraping Scripts (Local Only)

> Goal: Understand the wiki's HTML structure and extract clean data. No DB yet. Output to console and local JSON files.

### Steps

1. **Set up the project**
   - Init Node.js project with ESM (`"type": "module"` in `package.json`)
   - Install deps: `axios`, `cheerio`
   - Create `/scripts` and `/data` folders

2. **Explore the wiki structure**
   - Identify category listing pages for each entity, e.g.:
     - Characters: `marvel.fandom.com/wiki/Category:Characters`
     - Comics: `marvel.fandom.com/wiki/Category:Comics`
     - Teams: `marvel.fandom.com/wiki/Category:Teams`
     - Events: `marvel.fandom.com/wiki/Category:Events`
   - Inspect individual page HTML to locate infobox selectors (`.pi-data`, `[data-source="..."]`)

3. **Write a single-page scraper per entity**
   - Hardcode one example URL per entity to start
   - Log extracted fields to console
   - Confirm selectors are reliable across a few different pages

4. **Identify fields to capture per entity**

   > ⚠️ The fields below are rough starting points only — placeholders to guide initial exploration. What's actually available and worth storing will be decided after hands-on scraping. Treat these as questions, not decisions.

   **Characters** — `name`, `real_name`, `universe`, `aliases`, `affiliation`, `powers`, `first_appearance`, `wiki_url`, `image_url` *(TBD)*

   **Comics / Issues** — `title`, `issue_number`, `release_date`, `arc`, `wiki_url`, `cover_image_url` *(TBD)*

   **Teams / Groups** — `name`, `universe`, `members`, `base_of_operations`, `wiki_url`, `image_url` *(TBD)*

   **Story Events** — `name`, `universe`, `start_issue`, `end_issue`, `key_characters`, `wiki_url` *(TBD)*

5. **Write extracted data to JSON files**
   - Each script outputs to `/data/<entity>.json`
   - This is the source of truth before the DB is wired up

6. **Add basic rate limiting**
   - Add a configurable delay between requests (start at `800ms`)
   - Log each page fetch so progress is visible in terminal

### Notes
- Check `marvel.fandom.com/robots.txt` before scraping
- Keep scripts idempotent — re-running should overwrite, not duplicate
- Category pages are paginated — handle `?from=` query param for next page

---

## Phase 2 — Supabase Integration

> Goal: Connect to Supabase and validate the schema works before loading real data.

### Steps

1. **Create Supabase project**
   - Set up project on Supabase hobby tier
   - Store `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`

2. **Define schema**

   > ⚠️ Schema is TBD — to be designed after Phase 1 scraping exploration. The structure below is a placeholder only. Actual tables, columns, and relationships will be finalized once we know what data the wiki reliably provides.

   ```sql
   -- Placeholder — schema will be defined after Phase 1
   characters (id, ...TBD, wiki_url, created_at)
   comics     (id, ...TBD, wiki_url, created_at)
   teams      (id, ...TBD, wiki_url, created_at)
   events     (id, ...TBD, wiki_url, created_at)

   -- Join tables — relationships TBD based on what data is available
   -- e.g. character_teams, character_events, comic_events, etc.
   ```

   > Hobby tier has a 500MB DB limit — avoid storing large blobs. Store `image_url` as a string, not the image itself.

3. **Install Supabase JS SDK**
   - `npm install @supabase/supabase-js`
   - Create a shared `lib/supabase.js` client used by all scripts

4. **Write connection test script**
   - `scripts/test-connection.js`
   - Inserts one dummy row per table, reads it back, deletes it
   - Confirms schema + credentials are working

---

## Phase 3 — Full Scrape + DB Seed

> Goal: Run production scrapes across all category pages and load clean data into Supabase.

### Steps

1. **Upgrade scripts to crawl category pages**
   - Paginate through category listing pages to collect all entity URLs
   - Store discovered URLs in a queue

2. **Add resumability**
   - Track scraped URLs in a local `.scraped-urls.json` file or a `scrape_log` table in Supabase
   - On restart, skip already-processed URLs

3. **Write `seed-db.js`**
   - Reads from `/data/*.json` (or pipes directly from scraper)
   - Upserts records into Supabase using `wiki_url` as a unique key to avoid duplicates
   - Handles join table population after core tables are seeded

4. **Validate data in Supabase dashboard**
   - Spot check a few characters, teams, events
   - Confirm relationships are correct in join tables
   - Check row counts are reasonable

5. **Handle errors gracefully**
   - Pages that 404, timeout, or have unexpected HTML should be logged to a `failed_urls.json` and skipped
   - Never let one bad page crash the full scrape

---

## Phase 4 — NestJS API

> Goal: Expose the Supabase data via a clean RESTful API with Swagger docs and API key auth.

### Steps

1. **Scaffold NestJS project**
   - `nest new src` or init inside `/src`
   - Install: `@nestjs/swagger`, `@supabase/supabase-js`, `swagger-ui-express`

2. **Supabase service**
   - Create a shared `SupabaseService` injectable that wraps the client
   - Used by all feature modules

3. **API key auth**
   - Implement a NestJS `Guard` that checks for `x-api-key` header
   - Key stored in `.env`, applied globally or per-route
   - Return `401` on missing/invalid key

4. **Feature modules** (one per entity)

   Each module gets: `module`, `controller`, `service`

   **Endpoints per entity:**

   ```
   GET /characters              # List all, with pagination + filters (universe, name)
   GET /characters/:id          # Single character
   GET /characters/:id/teams    # Teams a character belongs to
   GET /characters/:id/events   # Events a character appeared in

   GET /comics                  # List all, with filters (arc, release_date)
   GET /comics/:id              # Single comic

   GET /teams                   # List all, with filters (universe)
   GET /teams/:id               # Single team
   GET /teams/:id/members       # Characters in the team

   GET /events                  # List all
   GET /events/:id              # Single event
   GET /events/:id/characters   # Characters in the event
   GET /events/:id/comics       # Comics in the event
   ```

5. **Swagger setup**
   - Configure `@nestjs/swagger` in `main.ts`
   - Decorate all DTOs and controllers with Swagger decorators
   - Swagger UI accessible at `/api/docs`
   - All endpoints testable directly in browser (with API key input)

6. **Pagination**
   - All list endpoints support `?page=` and `?limit=` query params
   - Default limit: 20, max: 100

---

## Out of Scope (for now)

- Write endpoints (API is read-only)
- Image hosting / CDN (store URLs only)
- Scheduled re-scraping / auto-updates
- Rate limiting on the API itself
- Deployment (Supabase handles the DB; NestJS can be deployed separately later)