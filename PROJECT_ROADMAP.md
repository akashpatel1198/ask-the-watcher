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

> Characters and Comic Issues will need filtering — most pages are extremely obscure. Events, Teams, and Series are manageable in full.

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
- [ ] Per-entity cleaner testing (character done, comic/event/series/team remaining)

### Wikitext Cleaner — Findings from Character Testing

**Empty-string fields after cleaning are expected and harmless.** Two categories:

1. **`*Ref` fields (`NameRef`, `CurrentAliasRef`, `CharRef`)** — These are wiki-internal citation fields. Their entire content is `<ref>` tags and `{{r|...}}` templates pointing to which comic first used a name. The actual names live in `Name`, `CurrentAlias`, etc. These `*Ref` fields carry no display content and won't map to any API field — they can be dropped during schema design in Phase 2.

2. **`{{Navigation` / `{{MessageBox`-only fields** — Some fields (Powers, Weaknesses, Equipment, etc.) contain only a leaked wiki page-layout template. These are navigation chrome or editor notices on the wiki page, not entity data. The real content for these fields lives in other characters' pages; these specific characters just don't have data for that field beyond the layout block. Safe to drop.

~~**Known upstream issue: `{{MessageBox}}` splitting across fields.** The infobox parser captures `{{MessageBox` as a field value (e.g., `History`) and its closing `}}` bleeds into the next field (`Message`), leaving a stray `}}` artifact. This is a `parseInfobox` issue to fix when the parser is refactored into a shared utility in Phase 3 — not a cleaner issue.~~

**RESOLVED:** `parseInfobox` refactored into `lib/scraper-utils.js` as a shared function. Now strips `{{Navigation`/`{{MessageBox` fragments and stray `}}` during parsing. All 6 discovery scripts updated to import from shared util instead of defining inline copies.

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
