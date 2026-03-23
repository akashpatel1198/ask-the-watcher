# Marvel Wiki API — Project Roadmap

## Tech Stack

| Layer | Tool |
|---|---|
| Language | Node.js (ESM) |
| Data Source | MediaWiki API (`marvel.fandom.com/api.php`) |
| HTTP Client | `axios` |
| Database | Supabase (Free → Hobby Tier) |
| API Framework | NestJS |
| API Docs | `@nestjs/swagger` (Swagger UI) |
| Auth | API Key (via NestJS Guard) |

---

## Data Entities

The following entities will be scraped, stored, and exposed via the API:

- **Characters**
- **Comics / Issues**
- **Teams / Groups**
- **Story Events**

> Schema and field selection will be driven by the Discovery phase findings.

### Category Scale (as of discovery)

| Category | Page Count |
|---|---|
| Characters | ~98,500 |
| Comics | ~70,400 |
| Events | ~384 |
| Teams | ~6,700 |

> Characters and Comics will need filtering — most pages are extremely obscure. Events and Teams are manageable in full.

---

## Project Structure

```
/
├── scripts/
│   ├── discovery/                # Phase 1 — explore wiki data before building
│   │   ├── pre-testing/          # Early exploration scripts (category counts, search, field frequency)
│   │   ├── case-study/           # Deep dives on specific pages (Spider-Man variants)
│   │   │   └── output/           # (gitignored) JSON dumps from case study scripts
│   │   ├── character/            # Character entity discovery
│   │   │   └── output/           # (gitignored) JSON dumps for sampled characters
│   │   ├── comic/                # Comic entity discovery (TODO)
│   │   ├── team/                 # Team entity discovery (TODO)
│   │   └── event/                # Event entity discovery (TODO)
│   ├── scrape-characters.js      # Full scrape scripts (Phase 3)
│   ├── scrape-comics.js
│   ├── scrape-teams.js
│   ├── scrape-events.js
│   ├── seed-db.js
│   └── data/                     # (gitignored) JSON output from scrape scripts
├── lib/
│   ├── scraper-utils.js
│   └── supabase.js
├── src/                          # NestJS API (Phase 4)
│   ├── characters/
│   ├── comics/
│   ├── teams/
│   ├── events/
│   └── main.js
├── .env
└── PROJECT_ROADMAP.md
```

---

## Phase 1 — Discovery

> Goal: Use the MediaWiki API to understand what data is available for each entity type, how it's structured, and what's worth keeping. Output sample data to local JSON files. These findings will drive the database schema in Phase 2.

### Approach

We use `marvel.fandom.com/api.php` instead of HTML scraping. The wiki's MediaWiki API returns structured data (JSON) and doesn't block automated requests. Key endpoints:

- `action=query&list=categorymembers` — list pages in a category
- `action=parse&prop=wikitext` — get raw wikitext (contains infobox fields)
- `action=opensearch` — search for pages by title
- `action=query&prop=categoryinfo` — get category metadata (page counts)

### Key Findings So Far

**Infobox is the primary data source.** Each character/entity page has a wikitext infobox template with structured `| FieldName = Value` pairs. A custom parser extracts these, including multi-line fields (e.g., Powers spanning dozens of lines with sub-entries).

**Fields reliably available for Characters (9/9 sampled):**
Name, CurrentAlias, Aliases, Affiliation, Gender, Height, Weight, Eyes, Hair, Origin, Reality, PlaceOfBirth, Identity, Citizenship, Occupation, Education, Creators, First (first appearance), Powers, Abilities, Weaknesses, Equipment, Transportation, Weapons

**Fields sometimes available (varies by character):**
Overview (intro blurb), Codenames, Nicknames, Ancestors, Siblings, Spouses, Children, Relatives, Skin, Eyeballs

**Raw wikitext needs cleaning** — values contain wiki markup: `{{r|...}}` references, `{{Power|...}}` templates, `[[Link|Display Text]]` wiki links. A wikitext-to-clean-text parser will be needed before storing data.

### Progress

- [x] Category counts for all 4 entity types
- [x] Character field frequency analysis (9 well-known characters)
- [x] Case study: Spider-Man variants (Peter Parker, Ai Apaec, William Braddock) — compared field coverage across popular vs. obscure pages
- [x] Working multi-line infobox parser (handles `{{Clear}}`, continuation lines, nested bullet points)
- [x] Sample JSON output for 9 characters
- [ ] Comic entity discovery
- [ ] Team entity discovery
- [ ] Event entity discovery
- [ ] Wikitext-to-clean-text parser

---

## Phase 2 — Schema Design + Supabase Setup

> Goal: Design a relational DB schema informed by Phase 1 findings, set up Supabase, and validate the schema.

### Steps

1. **Design schema based on discovery data**
   - Pick final fields per entity
   - Define relationships (character ↔ team, character ↔ comic, event ↔ comic, etc.)
   - Account for Supabase free tier limits (500MB DB)

2. **Create Supabase project**
   - Store `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`

3. **Install Supabase JS SDK**
   - `npm install @supabase/supabase-js`
   - Shared `lib/supabase.js` client

4. **Write connection test script**
   - `scripts/test-connection.js`
   - Confirms schema + credentials are working

---

## Phase 3 — Full Scrape + DB Seed

> Goal: Run production scrapes across all entity categories and load clean data into Supabase.

### Steps

1. **Build wikitext-to-clean-text parser**
   - Strip `{{r|...}}` references
   - Resolve `[[Link|Display Text]]` wiki links to display text
   - Extract power names from `{{Power|...}}` templates
   - Handle nested templates and edge cases

2. **Decide filtering strategy per entity**
   - Characters (~98k): filter by field completeness, number of appearances, or curated lists
   - Comics (~70k): possibly track series rather than individual issues, or filter by notable series
   - Events (~384): likely keep all
   - Teams (~6.7k): likely keep most

3. **Write full scrape scripts**
   - Paginate through category pages to collect all entity URLs
   - Apply filters
   - Parse and clean data
   - Output to JSON

4. **Add resumability**
   - Track scraped URLs to allow restart without re-fetching

5. **Write `seed-db.js`**
   - Reads from JSON output
   - Upserts into Supabase using wiki page title as unique key
   - Populates join tables after core tables

6. **Validate data**
   - Spot check entities and relationships in Supabase dashboard

---

## Phase 4 — NestJS API

> Goal: Expose the Supabase data via a clean RESTful API with Swagger docs and API key auth.

### Steps

1. **Scaffold NestJS project**

2. **Supabase service**
   - Shared `SupabaseService` injectable

3. **API key auth**
   - NestJS `Guard` checking `x-api-key` header
   - Return `401` on missing/invalid key

4. **Feature modules** (one per entity)

   Each module gets: `module`, `controller`, `service`

   **Endpoints per entity:**

   ```
   GET /characters              # List all, with pagination + filters
   GET /characters/:id          # Single character
   GET /characters/:id/teams    # Teams a character belongs to
   GET /characters/:id/events   # Events a character appeared in

   GET /comics                  # List all, with filters
   GET /comics/:id              # Single comic

   GET /teams                   # List all, with filters
   GET /teams/:id               # Single team
   GET /teams/:id/members       # Characters in the team

   GET /events                  # List all
   GET /events/:id              # Single event
   GET /events/:id/characters   # Characters in the event
   GET /events/:id/comics       # Comics in the event
   ```

5. **Swagger setup**
   - Swagger UI at `/api/docs`
   - All endpoints testable in browser

6. **Pagination**
   - `?page=` and `?limit=` query params
   - Default limit: 20, max: 100

---

## Out of Scope (for now)

- Write endpoints (API is read-only)
- Image hosting / CDN (store URLs only)
- Scheduled re-scraping / auto-updates
- Rate limiting on the API itself
- Deployment (Supabase handles the DB; NestJS can be deployed separately later)
