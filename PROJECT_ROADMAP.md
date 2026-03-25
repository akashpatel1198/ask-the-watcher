# Marvel Wiki API — Project Roadmap

## Tech Stack

| Layer | Tool |
|---|---|
| Language | Node.js (ESM) |
| Data Source | MediaWiki API (`marvel.fandom.com/api.php`) |
| HTTP Client | `axios` |
| Database | SQLite via `better-sqlite3` (local `.db` file) |
| API Framework | NestJS |
| API Docs | `@nestjs/swagger` (Swagger UI) |
| Auth | API Key (via NestJS Guard) |
| Rate Limiting | `@nestjs/throttler` |

---

## Data Entities

The following entities will be scraped, stored, and exposed via the API:

- **Characters**
- **Comic Issues**
- **Comic Series**
- **Teams / Groups**
- **Story Events**

> Schema and field selection will be driven by the Discovery phase findings.

### Category Scale (as of discovery)

| Category | Page Count |
|---|---|
| Characters | ~98,500 |
| Comic Issues | ~70,400 |
| Comic Series | ~569 |
| Events | ~384 |
| Teams | ~6,700 |

> **Target: "Ambitious" tier** — ~10,000 characters + ~20,000 comic issues + all teams/series/events. Estimated DB file size: **~1 GB** on disk (including indexes). Characters and Comic Issues need filtering; the rest are kept in full.

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
│   │   ├── comic/                # Comic issue discovery
│   │   │   └── output/           # (gitignored) JSON dumps for sampled issues
│   │   ├── series/               # Comic series discovery
│   │   │   └── output/           # (gitignored) JSON dumps for sampled series
│   │   ├── team/                 # Team entity discovery
│   │   │   └── output/           # (gitignored) JSON dumps for sampled teams
│   │   └── event/                # Event entity discovery
│   │       └── output/           # (gitignored) JSON dumps for sampled events
│   ├── scrape-characters.js      # Full scrape scripts (Phase 3)
│   ├── scrape-comics.js
│   ├── scrape-teams.js
│   ├── scrape-events.js
│   ├── seed-db.js
│   └── data/                     # (gitignored) JSON output from scrape scripts
├── lib/
│   ├── scraper-utils.js
│   └── db.js                     # Shared SQLite client (better-sqlite3)
├── data/
│   └── marvel.db                 # (gitignored) SQLite database file
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

**Comic Issues and Series are separate entities.** The wiki has both series pages (~569) and individual issue pages (~70k). Issues are the richer data source; series pages provide metadata about the run as a whole. Both are worth keeping as separate entities with a series→issues relationship.

**Fields reliably available for Comic Issues (10 sampled):**
ReleaseDate, Month, Year, Editor-in-Chief, Image1, StoryTitle1, Writer/Penciler/Inker/Colorist/Letterer (per story), Appearing (character list with appearance tags), Synopsis, Quotation/Speaker, Notes, Trivia

**The `Appearing` field is a relationship goldmine.** It categorizes characters as Featured/Supporting/Antagonist, tags first appearances and deaths, and uses wiki links that map directly to character page titles (natural foreign keys).

**Comic Series are a lightweight grouping entity.** Series pages (~569) use a different infobox template from issues. The bulk of their fields are numbered creator lists (`writer1`/`writer1_issues`, `penciler1`/`penciler1_issues`, etc.) — long-running series can have 100+ fields just from creator rosters. The core metadata is slim but useful.

**Fields reliably available for Comic Series (16 sampled — mix of major + mid-tier + obscure):**
volume_logo, format (ongoing/limited/one-shot/etc.), type, status (finished/active), genres, featured (main character — wiki link)

**Fields commonly available:**
writerN/writerN_issues, pencilerN/pencilerN_issues (numbered creator rosters with issue ranges), partN/partN_above (era/run divisions)

**Fields sometimes available:**
Notes, Accolades, year, SeeAlso, PreviousVol

**Key relationship fields for Comic Series:**
- `featured` → character wiki link — series↔character relationship (which character headlines the series).
- Series→issue relationship is derived from naming convention: issue page titles embed the series name (e.g., `Amazing Spider-Man Vol 1 300` belongs to `Amazing Spider-Man Vol 1`).
- Per-issue creator credits are richer on issue pages than the series-level creator roster — issue pages should be the primary source for credits.

**Teams: flat category, rich infobox, inline member lists.** All ~6,692 team pages live flat under `Category:Teams` (6 subcategories: by Status, Type, Identity, Reality, Unseen, Year of Debut). Pages follow the `Name (Earth-616)` convention. Infobox fields are consistent across popular and obscure teams.

**Fields reliably available for Teams (13 sampled — mix of popular + obscure):**
Name, Image, Status, Identity, Reality, BaseOfOperations, Creators, First (first appearance), History

**Fields commonly available (8+ of 13):**
FormerMembers, Leaders, Enemies, Origin, PlaceOfFormation, CurrentMembers, Allies, Weapons/Equipment/Transportation

**Fields sometimes available:**
Last (only on defunct teams — 5/13), Aliases, EditorialNames, Overview, Quotation/Speaker, Notes, Trivia

**Key relationship fields for Teams:**
- `CurrentMembers` / `FormerMembers` → character wiki links (`[[Peter Parker (Earth-616)|Spider-Man]]`) — natural foreign keys to character pages. Most teams have inline member lists; very large teams (e.g., Avengers) redirect to a separate "List of X members" page.
- `First` / `Last` → issue page titles (`Sleepwalker Vol 1 2`) — direct links to comic issue pages.
- `Allies` / `Enemies` → mix of team and character wiki links — potential team↔team or team↔character relations.
- `Leaders` → character wiki links, usually 1–2 people — could be a tagged role on a team↔character join table.

**Redirect edge case:** Some teams use redirect page titles (e.g., `S.H.I.E.L.D. (Earth-616)` redirects to `Strategic Homeland Intervention, Enforcement and Logistics Division (Earth-616)`). The full scraper will need to follow redirects to get the actual infobox data.

**Events: different infobox structure, rich synopses, ordered reading lists.** Only ~384 pages. Events don't use `(Earth-616)` suffixes — they use `(Event)` suffix or plain titles. Each event gets its own subcategory (425 subcategories total) for related comics. The infobox is structured as a "story card" rather than an entity card.

**Fields reliably available for Events (14 sampled — mix of major crossovers + obscure):**
Name, Image, First, Synopsis (100%), Reality (93%)

**Fields commonly available (8+ of 14):**
Part1–PartN (ordered reading list, 86%), Protagonists (79%), Trivia (79%), Aliases (71%), Antagonists (71%), Last (71%)

**Fields sometimes available:**
Locations (57%), TieIns (57%), Creators (50% — many events span multiple creative teams), Others (36%), Quotation/Speaker, Notes, Prelude

**The `Synopsis` field is exceptionally rich.** Every sampled event has a full plot summary — not just a blurb but a detailed narrative covering the entire event. This is significantly more substantial than team/character Overview fields and is ideal for API consumers.

**The `Part1`–`PartN` fields provide structured reading order.** Each part maps to an issue page title, giving an ordered event→comic relationship. Events range from 6 parts (Infinity Gauntlet) to 24+ parts (larger crossovers).

**Key relationship fields for Events:**
- `Protagonists` / `Antagonists` / `Others` → character AND team wiki links mixed together — can be parsed into event↔character and event↔team joins, tagged by role (protagonist/antagonist/other).
- `Part1`–`PartN` → ordered issue page titles — event↔comic join with explicit reading order.
- `First` / `Last` → issue page titles — bookend references.
- `TieIns` / `Prelude` → additional issue references via `{{cl|...}}` templates — supplementary event↔comic relations.

**Events are small enough (~384) to keep all without filtering.**

### Progress

- [x] Category counts for all 4 entity types
- [x] Character field frequency analysis (9 well-known characters)
- [x] Case study: Spider-Man variants (Peter Parker, Ai Apaec, William Braddock) — compared field coverage across popular vs. obscure pages
- [x] Working multi-line infobox parser (handles `{{Clear}}`, continuation lines, nested bullet points)
- [x] Sample JSON output for 9 characters
- [x] Comic discovery: explored category structure, separated issues and series as distinct entities
- [x] Comic issue discovery: sampled 10 iconic issues
- [x] Comic series discovery: sampled 12 series pages
- [x] Team discovery: explored category structure (flat, 6 subcategories)
- [x] Team discovery: sampled 14 teams (6 popular, 4 mid-tier, 4 obscure), field frequency analysis
- [x] Team discovery: identified relationship fields (members→characters, first/last→issues, allies/enemies)
- [x] Team discovery: debugged S.H.I.E.L.D. redirect edge case
- [x] Event discovery: explored category structure (~384 pages, 425 subcategories, no Earth-616 suffix)
- [x] Event discovery: sampled 14 events (6 major crossovers, 4 mid-tier, 4 obscure), field frequency analysis
- [x] Event discovery: identified relationship fields (protagonists/antagonists→characters+teams, PartN→ordered reading list, tie-ins)
- [x] Comic issue fetch-sample: added mid-tier/obscure issues (16 total), field frequency analysis — core fields hold at 100% across popular and obscure
- [x] Comic series fetch-sample: sampled 16 series (12 major + 4 mid-tier/obscure), field frequency analysis — 6 core metadata fields, rest is creator rosters
- [x] Wikitext-to-clean-text parser (`lib/scraper-utils.js` → `cleanWikitext()`)
- [x] Per-entity cleaner testing — all 5 entities pass with 0 flagged (character, comic, event, series, team)

### Wikitext Cleaner — Findings from Character Testing

**Empty-string fields after cleaning are expected and harmless.** Two categories:

1. **`*Ref` fields (`NameRef`, `CurrentAliasRef`, `CharRef`)** — These are wiki-internal citation fields. Their entire content is `<ref>` tags and `{{r|...}}` templates pointing to which comic first used a name. The actual names live in `Name`, `CurrentAlias`, etc. These `*Ref` fields carry no display content and won't map to any API field — they can be dropped during schema design in Phase 2.

2. **`{{Navigation` / `{{MessageBox`-only fields** — Some fields (Powers, Weaknesses, Equipment, etc.) contain only a leaked wiki page-layout template. These are navigation chrome or editor notices on the wiki page, not entity data. The real content for these fields lives in other characters' pages; these specific characters just don't have data for that field beyond the layout block. Safe to drop.

~~**Known upstream issue: `{{MessageBox}}` splitting across fields.** The infobox parser captures `{{MessageBox` as a field value (e.g., `History`) and its closing `}}` bleeds into the next field (`Message`), leaving a stray `}}` artifact. This is a `parseInfobox` issue to fix when the parser is refactored into a shared utility in Phase 3 — not a cleaner issue.~~

**RESOLVED:** `parseInfobox` refactored into `lib/scraper-utils.js` as a shared function. Now strips `{{Navigation`/`{{MessageBox` fragments and stray `}}` during parsing. All 6 discovery scripts updated to import from shared util instead of defining inline copies.

---

## Phase 2 — Schema Design + SQLite Setup

> Goal: Design a relational DB schema informed by Phase 1 findings, set up SQLite, and validate the schema.

### Database Choice: SQLite

**Why SQLite over Supabase/Postgres:**
- The API is read-heavy (scrape once, serve forever) — SQLite's ideal use case
- No storage limits — local file on disk, no free-tier constraints
- No network latency for queries — direct file reads
- Zero cost, zero external dependencies
- Estimated DB size: ~1 GB for the "Ambitious" target (10k characters, 20k comics, all others)

**Hosting:** Deploy the NestJS API + `.db` file together on a host with persistent disk (Fly.io, Railway, or a $4/mo VPS).

### Steps

1. **Add image URL support**
   - New `resolveImageUrl()` function in `lib/scraper-utils.js` — resolves wiki image filenames to full CDN URLs via MediaWiki `action=query&prop=imageinfo` API
   - Update `fetch-sample.js` scripts per entity to pull infobox images (`Image` or `Image1` field depending on entity)
   - Each entity schema will include an `image_url` column

2. **Design schema per entity** (one at a time)
   - Go through each entity's discovery data, pick fields to keep vs. drop
   - Output `schema/{entity}.json` files with column definitions, types, and notes on dropped fields
   - Entity order: characters → comics → series → teams → events
   - Each schema includes `image_url` from step 1

3. **Beta scripts per entity** — validate schema shape before building real scraper
   - Each entity gets a `beta-script.js` in its discovery directory
   - Full pipeline in one script: fetch from wiki → parse infobox → resolve image → clean via `cleanWikitext()` → map to schema columns → output `beta_*.json` files
   - Uses the same hardcoded sample pages from discovery (not full category scrape)
   - Output files are DB-ready rows — validates the schema works end-to-end
   - Cleaner issues found during beta testing are fixed in `cleanWikitext()` (e.g., wiki section headers `===`, `thumb|` image tags, `[[Category:]]` tags, orphaned `]]` brackets were all caught and fixed this way)

4. **Design join tables**
   - After all 5 entity schemas are finalized, define the relationship/join tables
   - character ↔ team, character ↔ comic, character ↔ event, comic ↔ event, comic ↔ series, character ↔ series

5. **Install `better-sqlite3`**
   - `npm install better-sqlite3`
   - Shared `lib/db.js` client

6. **Write schema migration script**
   - `scripts/setup-db.js` — creates tables, indexes, and join tables
   - Outputs to `data/marvel.db` (gitignored)

7. **Write connection test script**
   - `scripts/test-connection.js`
   - Confirms schema is created and queryable

### Progress

- [x] Image URL support added to `lib/scraper-utils.js` and character `fetch-sample.js`
- [x] Character schema designed (`schema/characters.json` — 36 columns, Option C)
- [x] Character beta script (`scripts/discovery/character/beta-script.js`) — 9 samples validated, all clean
- [x] Cleaner fixes: wiki section headers, `thumb|` tags, `[[Category:]]` tags, orphaned `]]`
- [ ] Comic schema
- [ ] Comic beta script
- [ ] Series schema
- [ ] Series beta script
- [ ] Team schema
- [ ] Team beta script
- [ ] Event schema
- [ ] Event beta script
- [ ] Join table design
- [ ] Install `better-sqlite3` + `lib/db.js`
- [ ] Schema migration script
- [ ] Connection test script

---

## Phase 3 — Full Scrape + DB Seed

> Goal: Run production scrapes across all entity categories and load clean data into SQLite.

### Target Counts ("Ambitious" Tier)

| Entity | Target | Strategy |
|---|---|---|
| Comic Series | all ~569 | Keep all — scrape first |
| Events | all ~384 | Keep all — scrape first |
| Teams | all ~6,700 | Keep all — scrape first |
| Comic Issues | ~20,000 (cap) | Filtered + ranked — scrape after small entities |
| Characters | ~10,000 (cap) | Filtered + ranked — scrape last |

### Scrape Order & Filtering Strategy

Small entities are scraped first. Their relationship data informs which characters and comics to keep.

**Step 1 — Scrape small entities (no filtering needed)**
1. Comic Series (all ~569)
2. Events (all ~384) → extracts `Part1`–`PartN`, `TieIns` → **builds issue inclusion list**
3. Teams (all ~6,700) → extracts `CurrentMembers`, `FormerMembers` → **builds character inclusion list**

**Step 2 — Scrape comics (two-pass filter, 20k cap)**
- **Pass 1 — Relationship-based inclusion:** Keep any issue that is:
  - Referenced by an event (`PartN`, `TieIns`, `First`/`Last`)
  - Part of a top series (rank series by issue count, keep top 100–150)
  - Contains `{{1st|...}}` first appearance tags or `{{Death|...}}` tags in `Appearing`
- **Pass 2 — Quality-based cap:** If Pass 1 yields >20k, rank remaining by wikitext length (available from API before full parse) and cut from the bottom.
- After scraping, extract all character wiki links from `Appearing` fields → **adds to character inclusion list**

**Step 3 — Scrape characters (two-pass filter, 10k cap)**
- **Pre-filter:** Earth-616 only (~98k → ~40k)
- **Pass 1 — Relationship-based inclusion:** Keep any character that is:
  - A team member (from Step 1 team data)
  - An event protagonist/antagonist/other (from Step 1 event data)
  - Referenced in comic `Appearing` fields (from Step 2)
- **Pass 2 — Quality-based cap:** If Pass 1 yields >10k, rank remaining by wikitext length or infobox field count and cut from the bottom.

### Steps

1. ~~**Build wikitext-to-clean-text parser**~~ *(done in Phase 1 — `cleanWikitext()` in `lib/scraper-utils.js`)*

2. **Scrape small entities** (series, events, teams)
   - Paginate through category pages to collect all entity URLs
   - Parse and clean data
   - Extract relationship references (event→issues, team→characters)
   - Output to JSON

3. **Scrape comics** (filtered, 20k cap)
   - Build inclusion list from event references + top series
   - Scrape included issues, parse and clean
   - Apply quality-based cap if over 20k
   - Extract character references from `Appearing` fields
   - Output to JSON

4. **Scrape characters** (filtered, 10k cap)
   - Build inclusion list from team members + event characters + comic appearances
   - Filter to Earth-616 only
   - Scrape included characters, parse and clean
   - Apply quality-based cap if over 10k
   - Output to JSON

5. **Add resumability**
   - Track scraped URLs to allow restart without re-fetching

6. **Write `seed-db.js`**
   - Reads from JSON output
   - Inserts into SQLite using wiki page title as unique key
   - Populates join tables after core tables

7. **Validate data**
   - Spot check entities and relationships via SQLite queries

---

## Phase 4 — NestJS API

> Goal: Expose the SQLite data via a clean RESTful API with Swagger docs, API key auth, and rate limiting.

### Steps

1. **Scaffold NestJS project**

2. **SQLite service**
   - Shared `DatabaseService` injectable wrapping `better-sqlite3`
   - Reads from `data/marvel.db`

3. **API key auth**
   - `api_keys` table in SQLite: `(id, key_hash, user_email, created_at, tier)`
   - NestJS `Guard` checking `x-api-key` header, hashes and looks up in DB
   - Return `401` on missing/invalid key

4. **Rate limiting**
   - `@nestjs/throttler` — in-memory, per-key limits
   - Tier-based: e.g., free = 100 req/min, paid = 1000 req/min

5. **Feature modules** (one per entity)

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

6. **Swagger setup**
   - Swagger UI at `/api/docs`
   - All endpoints testable in browser

7. **Pagination**
   - `?page=` and `?limit=` query params
   - Default limit: 20, max: 100

---

## Out of Scope (for now)

- Write endpoints (API is read-only, except API key registration)
- Image hosting / CDN (store URLs only)
- Scheduled re-scraping / auto-updates
- Multi-server deployment (SQLite is single-server; upgrade to Turso if needed later)
- User-facing registration UI (API keys issued manually or via admin endpoint)
